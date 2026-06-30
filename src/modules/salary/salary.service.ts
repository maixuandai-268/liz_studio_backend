import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SalaryPeriod } from './entities/salary-periodi.entity';
import { SalaryRecord } from './entities/salary-record.entity';
import { Employee } from '@/modules/employee/entities/emplyee.entity';
import { Level } from '@/modules/levels/entities/levels.entity';
import { EmployeeKpi } from '@/modules/kpi/entities/employee-kpi.entity';
import { NotificationTriggersService } from '@/modules/notifications/notification-triggers.service';
import { User } from '@/modules/users/entities/user.entity';

@Injectable()
export class SalaryService {
  private logger = new Logger('SalaryService');

  constructor(
    @InjectRepository(SalaryPeriod)
    private periodRepo: Repository<SalaryPeriod>,
    @InjectRepository(SalaryRecord)
    private recordRepo: Repository<SalaryRecord>,
    @InjectRepository(Employee)
    private employeeRepo: Repository<Employee>,
    @InjectRepository(Level)
    private levelRepo: Repository<Level>,
    @InjectRepository(EmployeeKpi)
    private kpiRepo: Repository<EmployeeKpi>,
    private notificationTriggers: NotificationTriggersService,
    @InjectRepository(User)
    private userRepo: Repository<User>,
  ) {}

  private async fireSalaryApprovedNotif(userId: number) {
    try {
      const emp = await this.employeeRepo.findOne({ where: { userId } as any });
      const user = await this.userRepo.findOne({ where: { id: userId } });
      const name = (emp as any)?.full_name || `User #${userId}`;
      await this.notificationTriggers.salaryApproved(userId, name, user?.email).catch(e => this.logger.error(`[NOTIF-SALARY] ${e.message}`));
    } catch (err) {
      this.logger.error(`[NOTIF-SALARY-ERR] ${(err as any).message}`);
    }
  }

  // ── Quarters ──

  async createQuarter(dto: { quarter: number; year: number; created_by: number }) {
    const { quarter, year, created_by } = dto;
    const startMonth = (quarter - 1) * 3 + 1;
    const months = [startMonth, startMonth + 1, startMonth + 2];

    const name = `Q${quarter}/${year}`;

    // Check if any period already exists for this quarter
    const existing = await this.periodRepo.find({ where: { quarter, year } as any });
    if (existing.length > 0) {
      throw new BadRequestException(`Quý ${name} đã tồn tại`);
    }

    const created: SalaryPeriod[] = [];
    for (const month of months) {
      const period = this.periodRepo.create({
        name: `Tháng ${month}/${year}`,
        month,
        year,
        quarter,
        created_by,
        status: 'pending',
      } as any);
      created.push(await this.periodRepo.save(period as any));
    }

    this.logger.log(`[SALARY] Created quarter ${name} with ${created.length} periods`);
    return created;
  }

  async getQuarters(): Promise<{ quarter: number; year: number; periods: SalaryPeriod[] }[]> {
    const periods = await this.periodRepo.find({ order: { year: 'DESC', quarter: 'DESC', month: 'ASC' } as any });
    const map = new Map<string, { quarter: number; year: number; periods: SalaryPeriod[] }>();

    for (const p of periods) {
      const key = `Q${p.quarter || Math.ceil((p.month || 1) / 3)}-${p.year}`;
      if (!map.has(key)) {
        map.set(key, {
          quarter: p.quarter || Math.ceil((p.month || 1) / 3),
          year: p.year,
          periods: [],
        });
      }
      map.get(key)!.periods.push(p);
    }

    return Array.from(map.values());
  }

  // ── Preview (no save) ──

  async preview(periodId: number) {
    const period = await this.getPeriod(periodId);
    const employees = await this.employeeRepo.find();

    const previews: any[] = [];

    for (const emp of employees) {
      const level = emp.level_id
        ? await this.levelRepo.findOne({ where: { id: emp.level_id } as any })
        : null;

      const baseSalary = Number(emp.base_salary || level?.salary_coefficient || 0);
      const kpiTarget = level?.kpi_target || 100;
      const kpiSalary = level?.kpi_salary || 0;

      const startDate = new Date(period.year, period.month - 1, 1);
      const endDate = new Date(period.year, period.month, 0);

      const kpis = await this.kpiRepo
        .createQueryBuilder('kpi')
        .where('kpi.user_id = :userId', { userId: emp.userId })
        .andWhere('kpi.achieved_date >= :start', { start: startDate.toISOString().split('T')[0] })
        .andWhere('kpi.achieved_date <= :end', { end: endDate.toISOString().split('T')[0] })
        .getMany();

      const totalKpiPoints = kpis.reduce((s, k) => s + Number(k.points), 0);
      const productivityPercentage = kpiTarget > 0
        ? Math.min(Math.round((totalKpiPoints / kpiTarget) * 10000) / 100, 200)
        : 0;

      const kpiComponent = Math.round(kpiSalary * (productivityPercentage / 100) * 100) / 100;
      const grossSalary = Math.round((baseSalary + kpiComponent) * 100) / 100;

      // Try to find existing saved record
      const existingRecord = await this.recordRepo.findOne({
        where: { period_id: periodId, userId: emp.userId } as any,
      });

      previews.push({
        userId: emp.userId,
        full_name: emp.full_name,
        avatar_url: emp.avatar_url,
        level_id: emp.level_id,
        base_salary: baseSalary,
        kpi_points: Math.round(totalKpiPoints * 100) / 100,
        kpi_target: kpiTarget,
        kpi_salary: kpiSalary,
        productivity_percentage: productivityPercentage,
        kpi_component: kpiComponent,
        gross_salary: grossSalary,
        bonus: existingRecord ? Number(existingRecord.bonus) : 0,
        penalty: existingRecord ? Number(existingRecord.penalty) : 0,
        net_salary: Math.round((grossSalary + (existingRecord ? Number(existingRecord.bonus) : 0) - (existingRecord ? Number(existingRecord.penalty) : 0)) * 100) / 100,
        record_id: existingRecord?.id || null,
        status: existingRecord?.status || null, // null = not saved, 'pending' = saved, 'approved' = done
      });
    }

    return previews;
  }

  // ── Save records (batch upsert) ──

  async saveRecords(
    periodId: number,
    records: { userId: number; bonus: number; penalty: number }[],
  ) {
    const period = await this.getPeriod(periodId);
    const saved: SalaryRecord[] = [];

    for (const rec of records) {
      // Calculate fresh preview values for this user
      const emp = await this.employeeRepo.findOne({ where: { userId: rec.userId } as any });
      if (!emp) continue;

      const level = emp.level_id
        ? await this.levelRepo.findOne({ where: { id: emp.level_id } as any })
        : null;

      const baseSalary = Number(emp.base_salary || level?.salary_coefficient || 0);
      const kpiTarget = level?.kpi_target || 100;
      const kpiSalary = level?.kpi_salary || 0;

      const startDate = new Date(period.year, period.month - 1, 1);
      const endDate = new Date(period.year, period.month, 0);

      const kpis = await this.kpiRepo
        .createQueryBuilder('kpi')
        .where('kpi.user_id = :userId', { userId: rec.userId })
        .andWhere('kpi.achieved_date >= :start', { start: startDate.toISOString().split('T')[0] })
        .andWhere('kpi.achieved_date <= :end', { end: endDate.toISOString().split('T')[0] })
        .getMany();

      const totalKpiPoints = kpis.reduce((s, k) => s + Number(k.points), 0);
      const productivityPercentage = kpiTarget > 0
        ? Math.min(Math.round((totalKpiPoints / kpiTarget) * 10000) / 100, 200)
        : 0;

      const kpiComponent = Math.round(kpiSalary * (productivityPercentage / 100) * 100) / 100;
      const grossSalary = Math.round((baseSalary + kpiComponent) * 100) / 100;
      const netSalary = Math.round((grossSalary + rec.bonus - rec.penalty) * 100) / 100;

      // Upsert
      let record = await this.recordRepo.findOne({
        where: { period_id: periodId, userId: rec.userId } as any,
      });

      const data = {
        period_id: periodId,
        userId: rec.userId,
        level_id: emp.level_id || undefined,
        salary_coefficient: level?.salary_coefficient || 0,
        base_salary: baseSalary,
        kpi_points: Math.round(totalKpiPoints * 100) / 100,
        kpi_target: kpiTarget,
        kpi_salary: kpiSalary,
        productivity_percentage: productivityPercentage,
        kpi_component: kpiComponent,
        gross_salary: grossSalary,
        deductions: 0,
        bonus: Math.round(rec.bonus * 100) / 100,
        penalty: Math.round(rec.penalty * 100) / 100,
        net_salary: netSalary,
        status: 'pending',
      } as any;

      if (record) {
        Object.assign(record, data);
      } else {
        record = this.recordRepo.create(data) as unknown as SalaryRecord;
      }
      saved.push(await this.recordRepo.save(record as any));
    }

    // Update period status
    period.status = 'calculated';
    await this.periodRepo.save(period as any);

    this.logger.log(`[SALARY] Saved ${saved.length} records for period ${periodId}`);
    return saved;
  }

  // ── Periods ──

  async createPeriod(dto: { name: string; month: number; year: number; quarter?: number; pay_date?: string; created_by: number }) {
    const existing = await this.periodRepo.findOne({ where: { month: dto.month, year: dto.year } as any });
    if (existing) {
      throw new BadRequestException('Kỳ lương tháng này đã tồn tại');
    }
    const period = this.periodRepo.create({
      name: dto.name,
      month: dto.month,
      year: dto.year,
      quarter: dto.quarter || Math.ceil((dto.month || 1) / 3),
      pay_date: dto.pay_date ? new Date(dto.pay_date) : null,
      created_by: dto.created_by,
      status: 'pending',
    } as any);
    return this.periodRepo.save(period as any);
  }

  async getPeriods() {
    return this.periodRepo.find({ order: { year: 'DESC', month: 'DESC' } as any });
  }

  async getPeriod(id: number) {
    const period = await this.periodRepo.findOne({ where: { id } as any });
    if (!period) throw new NotFoundException('Kỳ lương không tồn tại');
    return period;
  }

  // ── Records ──

  async calculate(periodId: number) {
    // Legacy — still supported but saveRecords is preferred
    const period = await this.getPeriod(periodId);
    const employees = await this.employeeRepo.find();

    const records: SalaryRecord[] = [];

    for (const emp of employees) {
      const level = emp.level_id
        ? await this.levelRepo.findOne({ where: { id: emp.level_id } as any })
        : null;

      const baseSalary = Number(emp.base_salary || level?.salary_coefficient || 0);
      const kpiTarget = level?.kpi_target || 100;
      const kpiSalary = level?.kpi_salary || 0;

      const startDate = new Date(period.year, period.month - 1, 1);
      const endDate = new Date(period.year, period.month, 0);

      const kpis = await this.kpiRepo
        .createQueryBuilder('kpi')
        .where('kpi.user_id = :userId', { userId: emp.userId })
        .andWhere('kpi.achieved_date >= :start', { start: startDate.toISOString().split('T')[0] })
        .andWhere('kpi.achieved_date <= :end', { end: endDate.toISOString().split('T')[0] })
        .getMany();

      const totalKpiPoints = kpis.reduce((s, k) => s + Number(k.points), 0);
      const productivityPercentage = kpiTarget > 0
        ? Math.min(Math.round((totalKpiPoints / kpiTarget) * 10000) / 100, 200)
        : 0;

      const kpiComponent = Math.round(kpiSalary * (productivityPercentage / 100) * 100) / 100;
      const grossSalary = Math.round((baseSalary + kpiComponent) * 100) / 100;
      const deductions = 0;
      const bonus = 0;
      const penalty = 0;
      const netSalary = Math.round((grossSalary + bonus - penalty) * 100) / 100;

      const record = this.recordRepo.create({
        period_id: periodId,
        userId: emp.userId,
        level_id: emp.level_id || undefined,
        salary_coefficient: level?.salary_coefficient || 0,
        base_salary: baseSalary,
        kpi_points: Math.round(totalKpiPoints * 100) / 100,
        kpi_target: kpiTarget,
        kpi_salary: kpiSalary,
        productivity_percentage: productivityPercentage,
        kpi_component: kpiComponent,
        gross_salary: grossSalary,
        deductions,
        bonus,
        penalty,
        net_salary: netSalary,
        status: 'pending',
      } as any);
      records.push(await this.recordRepo.save(record as any));
    }

    period.status = 'calculated';
    await this.periodRepo.save(period as any);

    this.logger.log(`[SALARY] Calculated ${records.length} records for period ${periodId}`);
    return records;
  }

  async getRecords(periodId: number) {
    return this.recordRepo.find({
      where: { period_id: periodId } as any,
      order: { id: 'ASC' } as any,
    });
  }

  async getMyRecords(userId: number) {
    return this.recordRepo.find({
      where: { userId } as any,
      order: { period_id: 'DESC' } as any,
    });
  }

  async updateRecord(recordId: number, data: { base_salary?: number; bonus?: number; penalty?: number }) {
    const record = await this.recordRepo.findOne({ where: { id: recordId } as any });
    if (!record) throw new NotFoundException('Record không tồn tại');

    if (data.base_salary !== undefined) record.base_salary = data.base_salary;
    if (data.bonus !== undefined) record.bonus = data.bonus;
    if (data.penalty !== undefined) record.penalty = data.penalty;

    const gross = Number(record.gross_salary);
    record.net_salary = Math.round((gross + Number(record.bonus) - Number(record.penalty)) * 100) / 100;

    return this.recordRepo.save(record as any);
  }

  async approveRecord(recordId: number, approvedBy: number) {
    const record = await this.recordRepo.findOne({ where: { id: recordId } as any });
    if (!record) throw new NotFoundException('Record không tồn tại');
    record.status = 'approved';
    record.approved_by = approvedBy;
    record.approved_at = new Date();
    return this.recordRepo.save(record as any).then(saved => {
      this.fireSalaryApprovedNotif((record as any).userId || (record as any).user_id).catch(() => undefined);
      return saved;
    });
  }

  async bulkApprove(periodId: number, approvedBy: number) {
    const records = await this.recordRepo.find({ where: { period_id: periodId, status: 'pending' } as any });
    await this.recordRepo.update(
      { period_id: periodId, status: 'pending' } as any,
      { status: 'approved', approved_by: approvedBy, approved_at: new Date() } as any,
    );
    for (const r of records) {
      this.fireSalaryApprovedNotif((r as any).userId || (r as any).user_id).catch(() => undefined);
    }
    return { success: true };
  }

  async deletePeriod(periodId: number) {
    await this.recordRepo.delete({ period_id: periodId } as any);
    await this.periodRepo.delete(periodId);
    return { success: true };
  }
}

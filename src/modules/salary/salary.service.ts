import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
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

  // Cache for employee name + email lookups
  private empNameCache: Map<number, { name: string; email?: string }> | null = null;
  private empNameCacheAt = 0;
  private async getEmpNameMap(): Promise<Map<number, { name: string; email?: string }>> {
    if (this.empNameCache && Date.now() - this.empNameCacheAt < 30_000) return this.empNameCache;
    const [emps, users] = await Promise.all([
      this.employeeRepo.find() as unknown as Employee[],
      this.userRepo.find({ select: ['id', 'email'] as any }),
    ]);
    const emailMap = new Map(users.map((u: any) => [u.id, u.email || '']));
    const map = new Map<number, { name: string; email?: string }>();
    for (const e of emps) {
      map.set(e.userId, { name: e.full_name || `User #${e.userId}`, email: emailMap.get(e.userId) || '' });
    }
    this.empNameCache = map;
    this.empNameCacheAt = Date.now();
    return map;
  }

  // Helper: batch-load levels + kpis + existing records for a set of employees
  private async loadSalaryData(
    userIds: number[],
    period: SalaryPeriod,
  ): Promise<{
    levels: Map<number, Level>;
    kpisByUser: Map<number, number>;
    existingRecords: Map<number, SalaryRecord>;
  }> {
    const levelIds = new Set<number>();

    // Get employees to extract level_ids, then batch load everything
    const employees = await this.employeeRepo.find({
      where: { userId: In(userIds) } as any,
    }) as unknown as Employee[];

    for (const e of employees) {
      if (e.level_id) levelIds.add(e.level_id);
    }

    const startDate = new Date(period.year, period.month - 1, 1);
    const endDate = new Date(period.year, period.month, 0);
    const startStr = startDate.toISOString().split('T')[0];
    const endStr = endDate.toISOString().split('T')[0];

    const [allLevels, allKpis, existingRecords] = await Promise.all([
      levelIds.size > 0
        ? this.levelRepo.find({ where: { id: In([...levelIds]) } as any })
        : Promise.resolve([]),
      this.kpiRepo.createQueryBuilder('kpi')
        .where('kpi.user_id IN (:...userIds)', { userIds })
        .andWhere('kpi.achieved_date >= :start', { start: startStr })
        .andWhere('kpi.achieved_date <= :end', { end: endStr })
        .getMany(),
      this.recordRepo.find({ where: { period_id: period.id, userId: In(userIds) } as any }),
    ]);

    const levelMap = new Map(allLevels.map((l: any) => [l.id, l]));
    const kpisByUser = new Map<number, number>();
    for (const k of allKpis) {
      kpisByUser.set((k as any).user_id, (kpisByUser.get((k as any).user_id) || 0) + Number(k.points));
    }
    const existingMap = new Map(existingRecords.map((r: any) => [r.userId, r]));

    return { levels: levelMap as Map<number, Level>, kpisByUser, existingRecords: existingMap as Map<number, SalaryRecord> };
  }

  private async fireSalaryApprovedNotif(userId: number) {
    try {
      const nameMap = await this.getEmpNameMap();
      const info = nameMap.get(userId);
      if (!info) return;
      await this.notificationTriggers.salaryApproved(userId, info.name, info.email).catch(e => this.logger.error(`[NOTIF-SALARY] ${e.message}`));
    } catch (err) {
      this.logger.error(`[NOTIF-SALARY-ERR] ${(err as any).message}`);
    }
  }

  // Helper for salary calculation
  private computeSalary(emp: any, level: any, totalKpiPoints: number, bonus = 0, penalty = 0) {
    const baseSalary = Number(emp.base_salary || level?.salary_coefficient || 0);
    const kpiTarget = level?.kpi_target || 100;
    const kpiSalary = level?.kpi_salary || 0;
    const productivityPercentage = kpiTarget > 0
      ? Math.min(Math.round((totalKpiPoints / kpiTarget) * 10000) / 100, 200)
      : 0;
    const kpiComponent = Math.round(kpiSalary * (productivityPercentage / 100) * 100) / 100;
    const grossSalary = Math.round((baseSalary + kpiComponent) * 100) / 100;
    return { baseSalary, kpiTarget, kpiSalary, productivityPercentage, kpiComponent, grossSalary, bonus, penalty };
  }

  async createQuarter(dto: { quarter: number; year: number; created_by: number }) {
    const { quarter, year, created_by } = dto;
    const startMonth = (quarter - 1) * 3 + 1;
    const months = [startMonth, startMonth + 1, startMonth + 2];

    const name = `Q${quarter}/${year}`;

    const existing = await this.periodRepo.find({ where: { quarter, year } as any });
    if (existing.length > 0) {
      throw new BadRequestException(`Quý ${name} đã tồn tại`);
    }

    // Batch create
    const periods = months.map((month) =>
      this.periodRepo.create({
        name: `Tháng ${month}/${year}`,
        month,
        year,
        quarter,
        created_by,
        status: 'pending',
      } as any),
    );
    const created = await this.periodRepo.save(periods as any);

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

  // Optimized: N+1 → 4 queries total
  async preview(periodId: number) {
    const period = await this.getPeriod(periodId);
    const employees = await this.employeeRepo
      .createQueryBuilder('employee')
      .leftJoinAndSelect('employee.user', 'user')
      .where('user.role = :role', { role: 'employee' })
      .getMany();

    const userIds = employees.map((e: any) => e.userId);
    if (userIds.length === 0) return [];

    const { levels, kpisByUser, existingRecords } = await this.loadSalaryData(userIds, period);

    // Build level lookup by userId
    const empLevelMap = new Map<number, any>();
    for (const emp of employees) {
      const level = emp.level_id ? levels.get(emp.level_id) : null;
      empLevelMap.set(emp.userId, level);
    }

    const previews: any[] = [];

    for (const emp of employees) {
      const level = empLevelMap.get(emp.userId);
      const totalKpiPoints = kpisByUser.get(emp.userId) || 0;
      const existingRecord = existingRecords.get(emp.userId);
      const { baseSalary, kpiTarget, kpiSalary, productivityPercentage, kpiComponent, grossSalary } =
        this.computeSalary(emp as any, level, totalKpiPoints);
      const bonusVal = existingRecord ? Number((existingRecord as any).bonus) : 0;
      const penaltyVal = existingRecord ? Number((existingRecord as any).penalty) : 0;

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
        bonus: bonusVal,
        penalty: penaltyVal,
        net_salary: Math.round((grossSalary + bonusVal - penaltyVal) * 100) / 100,
        record_id: existingRecord?.id || null,
        status: existingRecord?.status || null,
      });
    }

    return previews;
  }

  // Optimized: N+1 → 4 queries + batch save
  async saveRecords(
    periodId: number,
    records: { userId: number; bonus: number; penalty: number }[],
  ) {
    const period = await this.getPeriod(periodId);
    const userIds = records.map(r => r.userId);
    const { levels, kpisByUser, existingRecords } = await this.loadSalaryData(userIds, period);

    const employees = await this.employeeRepo.find({
      where: { userId: In(userIds) } as any,
    }) as unknown as Employee[];
    const empMap = new Map(employees.map((e: any) => [e.userId, e]));

    const toSave: SalaryRecord[] = [];

    for (const rec of records) {
      const emp = empMap.get(rec.userId);
      if (!emp) continue;

      const level = emp.level_id ? levels.get(emp.level_id) : null;
      const totalKpiPoints = kpisByUser.get(emp.userId) || 0;
      const { baseSalary, kpiTarget, kpiSalary, productivityPercentage, kpiComponent, grossSalary } =
        this.computeSalary(emp as any, level, totalKpiPoints);
      const netSalary = Math.round((grossSalary + rec.bonus - rec.penalty) * 100) / 100;

      let existingRecord = existingRecords.get(emp.userId);

      const data = {
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
        deductions: 0,
        bonus: Math.round(rec.bonus * 100) / 100,
        penalty: Math.round(rec.penalty * 100) / 100,
        net_salary: netSalary,
        status: 'pending',
      } as any;

      if (existingRecord) {
        Object.assign(existingRecord, data);
        toSave.push(existingRecord);
      } else {
        toSave.push(this.recordRepo.create(data) as unknown as SalaryRecord);
      }
    }

    const saved = await this.recordRepo.save(toSave);

    period.status = 'calculated';
    await this.periodRepo.save(period as any);

    this.logger.log(`[SALARY] Saved ${saved.length} records for period ${periodId}`);
    return saved;
  }

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

  // Optimized: N+1 → 4 queries + batch save
  async calculate(periodId: number) {
    const period = await this.getPeriod(periodId);
    const employees = await this.employeeRepo
      .createQueryBuilder('employee')
      .leftJoinAndSelect('employee.user', 'user')
      .where('user.role = :role', { role: 'employee' })
      .getMany();

    const userIds = employees.map((e: any) => e.userId);
    if (userIds.length === 0) return [];

    const { levels, kpisByUser } = await this.loadSalaryData(userIds, period);

    const records = employees.map((emp: any) => {
      const level = emp.level_id ? levels.get(emp.level_id) : null;
      const totalKpiPoints = kpisByUser.get(emp.userId) || 0;
      const { baseSalary, kpiTarget, kpiSalary, productivityPercentage, kpiComponent, grossSalary } =
        this.computeSalary(emp, level, totalKpiPoints);
      const netSalary = Math.round((grossSalary) * 100) / 100;

      return this.recordRepo.create({
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
        deductions: 0,
        bonus: 0,
        penalty: 0,
        net_salary: netSalary,
        status: 'pending',
      } as any);
    });

    const saved = await this.recordRepo.save(records as any);

    period.status = 'calculated';
    await this.periodRepo.save(period as any);

    this.logger.log(`[SALARY] Calculated ${saved.length} records for period ${periodId}`);
    return saved;
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

  // Optimized: batch fire notifications after bulk update
  async bulkApprove(periodId: number, approvedBy: number) {
    await this.recordRepo.update(
      { period_id: periodId, status: 'pending' } as any,
      { status: 'approved', approved_by: approvedBy, approved_at: new Date() } as any,
    );
    // After update, load and notify
    const records = await this.recordRepo.find({ where: { period_id: periodId, status: 'approved' } as any });
    await Promise.all(
      records.map(r => this.fireSalaryApprovedNotif((r as any).userId || (r as any).user_id).catch(() => undefined))
    );
    return { success: true };
  }

  async deletePeriod(periodId: number) {
    await this.recordRepo.delete({ period_id: periodId } as any);
    await this.periodRepo.delete(periodId);
    return { success: true };
  }
}

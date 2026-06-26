import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SalaryPeriod } from './entities/salary-periodi.entity';
import { SalaryRecord } from './entities/salary-record.entity';
import { Employee } from '@/modules/employee/entities/emplyee.entity';
import { Level } from '@/modules/levels/entities/levels.entity';
import { EmployeeKpi } from '@/modules/kpi/entities/employee-kpi.entity';

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
  ) {}

  // ── Periods ──

  async createPeriod(dto: { name: string; month: number; year: number; pay_date?: string; created_by: number }) {
    const existing = await this.periodRepo.findOne({ where: { month: dto.month, year: dto.year } as any });
    if (existing) {
      throw new BadRequestException('Kỳ lương tháng này đã tồn tại');
    }
    const period = this.periodRepo.create({
      name: dto.name,
      month: dto.month,
      year: dto.year,
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
    const period = await this.getPeriod(periodId);
    const employees = await this.employeeRepo.find({ where: { employment_status: true } as any });

    const records: SalaryRecord[] = [];

    for (const emp of employees) {
      const level = emp.level_id
        ? await this.levelRepo.findOne({ where: { id: emp.level_id } as any })
        : null;

      const baseSalary = level?.salary_coefficient || 0;
      const kpiTarget = level?.kpi_target || 100;

      // Sum KPI points for this employee in the period
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

      const coefficient = level?.salary_coefficient || 0;
      const grossSalary = Math.round(coefficient * (productivityPercentage / 100) * 100) / 100;
      const deductions = 0; // Can add attendance-based deductions later
      const netSalary = Math.round((grossSalary - deductions) * 100) / 100;

      const record = this.recordRepo.create({
        period_id: periodId,
        userId: emp.userId,
        level_id: emp.level_id || undefined,
        salary_coefficient: coefficient,
        base_salary: baseSalary,
        kpi_points: Math.round(totalKpiPoints * 100) / 100,
        kpi_target: kpiTarget,
        productivity_percentage: productivityPercentage,
        gross_salary: grossSalary,
        deductions,
        net_salary: netSalary,
        status: 'pending',
      } as any);
      records.push(await this.recordRepo.save(record as any));
    }

    // Update period status
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

  async approveRecord(recordId: number, approvedBy: number) {
    const record = await this.recordRepo.findOne({ where: { id: recordId } as any });
    if (!record) throw new NotFoundException('Record không tồn tại');
    record.status = 'approved';
    record.approved_by = approvedBy;
    record.approved_at = new Date();
    return this.recordRepo.save(record as any);
  }

  async bulkApprove(periodId: number, approvedBy: number) {
    await this.recordRepo.update(
      { period_id: periodId, status: 'pending' } as any,
      { status: 'approved', approved_by: approvedBy, approved_at: new Date() } as any,
    );
    return { success: true };
  }

  async deletePeriod(periodId: number) {
    await this.recordRepo.delete({ period_id: periodId } as any);
    await this.periodRepo.delete(periodId);
    return { success: true };
  }
}

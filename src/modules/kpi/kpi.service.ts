import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { KpiProductType } from './entities/kpi-product-type.entity';
import { EmployeeKpi } from './entities/employee-kpi.entity';
import { KpiMonthlySummary } from './entities/kpi-monthly-summary.entity';
import { CreateProductTypeDto } from './dto/create-product-type.dto';
import { UpdateProductTypeDto } from './dto/update-product-type.dto';

@Injectable()
export class KpiService {
  private logger = new Logger('KpiService');

  constructor(
    @InjectRepository(KpiProductType)
    private productTypeRepo: Repository<KpiProductType>,

    @InjectRepository(EmployeeKpi)
    private kpiRecordRepo: Repository<EmployeeKpi>,

    @InjectRepository(KpiMonthlySummary)
    private monthlySummaryRepo: Repository<KpiMonthlySummary>,
  ) {}


  async findAllProductTypes(): Promise<KpiProductType[]> {
    return this.productTypeRepo.find();
  }

  async createProductType(dto: CreateProductTypeDto): Promise<KpiProductType> {
    const item = this.productTypeRepo.create(dto);
    const saved = await this.productTypeRepo.save(item);
    this.logger.log(`[CREATE] Product type "${saved.name}" — base: ${saved.basePoints}`);
    return saved;
  }

  async updateProductType(id: number, dto: UpdateProductTypeDto): Promise<KpiProductType> {
    const item = await this.productTypeRepo.findOne({ where: { id } });
    if (!item) throw new NotFoundException(`Product type ${id} not found`);

    Object.assign(item, dto);
    const saved = await this.productTypeRepo.save(item);
    this.logger.log(`[UPDATE] Product type ${id} — base: ${saved.basePoints}`);
    return saved;
  }

  async deleteProductType(id: number): Promise<void> {
    const result = await this.productTypeRepo.delete(id);
    if (result.affected === 0) throw new NotFoundException(`Product type ${id} not found`);
    this.logger.log(`[DELETE] Product type ${id}`);
  }


  async updateMonthlySummary(userId: number, year: number, month: number) {
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = new Date(year, month, 0).toISOString().split('T')[0];

    const rows = await this.kpiRecordRepo.manager.connection.query(
      `SELECT COALESCE(SUM(points), 0) as total_points
       FROM employee_kpis
       WHERE user_id = $1 AND achieved_date >= $2 AND achieved_date <= $3`,
      [userId, startDate, endDate],
    );
    const totalPoints = Number(rows[0]?.total_points) || 0;

    const levelRows = await this.kpiRecordRepo.manager.connection.query(
      `SELECT l.kpi_target
       FROM levels l
       JOIN employee e ON e.level_id = l.id
       WHERE e.user_id = $1`,
      [userId],
    );
    const targetPoints = Number(levelRows[0]?.kpi_target) || 100;
    const productivityPercent = targetPoints > 0
      ? Math.min(Math.round((totalPoints / targetPoints) * 10000) / 100, 200)
      : 0;

    const existing = await this.monthlySummaryRepo.findOne({
      where: { userId, year, month } as any,
    });

    if (existing) {
      existing.totalPoints = totalPoints;
      existing.targetPoints = targetPoints;
      existing.productivityPercent = productivityPercent;
      await this.monthlySummaryRepo.save(existing);
    } else {
      const summary = this.monthlySummaryRepo.create({
        userId,
        year,
        month,
        totalPoints,
        targetPoints,
        productivityPercent,
      } as any);
      await this.monthlySummaryRepo.save(summary);
    }

    this.logger.log(`[SUMMARY] Updated user ${userId} for ${year}-${month}: ${totalPoints}/${targetPoints}`);
  }


  async summarizeAll(year: number, month: number) {
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = new Date(year, month, 0).toISOString().split('T')[0];

    const userIds = await this.kpiRecordRepo.manager.connection.query(
      `SELECT DISTINCT user_id FROM employee_kpis
       WHERE achieved_date >= $1 AND achieved_date <= $2`,
      [startDate, endDate],
    );

    const allUsers = await this.kpiRecordRepo.manager.connection.query(
      `SELECT DISTINCT e.user_id FROM employee e
       JOIN level l ON l.id = e.level_id`,
    );
    const seen = new Set(userIds.map((r: any) => Number(r.user_id)));
    for (const u of allUsers) {
      const uid = Number(u.user_id);
      if (!seen.has(uid)) {
        userIds.push({ user_id: uid });
        seen.add(uid);
      }
    }

    for (const row of userIds) {
      await this.updateMonthlySummary(Number(row.user_id), year, month);
    }

    this.logger.log(`[SUMMARY] Summarized ${userIds.length} users for ${year}-${month}`);
    return { users: userIds.length, year, month };
  }


  async getMonthlyRanking(year: number, month: number) {
    const summaries = await this.monthlySummaryRepo.find({
      where: { year, month } as any,
      order: { totalPoints: 'DESC' } as any,
    });

    if (summaries.length === 0) {
      return this.getMonthlyRankingFallback(year, month);
    }

    const employees = await this.kpiRecordRepo.manager.connection.query(
      `SELECT u.id as user_id, COALESCE(e.full_name, 'Unknown') as full_name
       FROM users u
       LEFT JOIN employee e ON e.user_id = u.id`,
    );
    const empMap = new Map(employees.map((e: any) => [Number(e.user_id), e.full_name]));

    return summaries.map((s, i) => ({
      rank: i + 1,
      userId: s.userId,
      fullName: empMap.get(s.userId) || `User #${s.userId}`,
      totalPoints: Number(s.totalPoints) || 0,
      targetPoints: Number(s.targetPoints) || 100,
      productivityPercent: Number(s.productivityPercent) || 0,
    }));
  }

  private async getMonthlyRankingFallback(year: number, month: number) {
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = new Date(year, month, 0).toISOString().split('T')[0];

    const raw = await this.kpiRecordRepo.manager.connection.query(
      `SELECT user_id, SUM(points) as total_points
       FROM employee_kpis
       WHERE achieved_date >= $1 AND achieved_date <= $2
       GROUP BY user_id
       ORDER BY total_points DESC`,
      [startDate, endDate],
    );

    const employees = await this.kpiRecordRepo.manager.connection.query(
      `SELECT u.id as user_id, COALESCE(e.full_name, 'Unknown') as full_name
       FROM users u
       LEFT JOIN employee e ON e.user_id = u.id`,
    );
    const empMap = new Map(employees.map((e: any) => [Number(e.user_id), e.full_name]));

    const levels = await this.kpiRecordRepo.manager.connection.query(
      `SELECT e.user_id, l.kpi_target FROM levels l JOIN employee e ON e.level_id = l.id`,
    );
    const levelMap = new Map(levels.map((l: any) => [l.user_id, Number(l.kpi_target) || 100]));

    return raw.map((r: any, i: number) => ({
      rank: i + 1,
      userId: Number(r.user_id),
      fullName: empMap.get(Number(r.user_id)) || `User #${r.user_id}`,
      totalPoints: Number(r.total_points) || 0,
      targetPoints: levelMap.get(Number(r.user_id)) || 100,
      productivityPercent: levelMap.get(Number(r.user_id))
        ? Math.min(Math.round((Number(r.total_points) / (levelMap.get(Number(r.user_id)) as number)) * 10000) / 100, 200)
        : 0,
    }));
  }

  async getEmployeeMonthlyPoints(userId: number, year: number, month: number) {
    const summary = await this.monthlySummaryRepo.findOne({
      where: { userId, year, month } as any,
    });

    if (summary) {
      return {
        totalPoints: Number(summary.totalPoints) || 0,
        targetPoints: Number(summary.targetPoints) || 100,
      };
    }

    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = new Date(year, month, 0).toISOString().split('T')[0];
    const rows = await this.kpiRecordRepo.manager.connection.query(
      'SELECT COALESCE(SUM(points), 0) as total_points FROM employee_kpis WHERE user_id = $1 AND achieved_date >= $2 AND achieved_date <= $3',
      [userId, startDate, endDate],
    );
    const totalPoints = Number(rows[0]?.total_points) || 0;
    const levelRows = await this.kpiRecordRepo.manager.connection.query(
      'SELECT l.kpi_target FROM levels l JOIN employee e ON e.level_id = l.id WHERE e.user_id = $1',
      [userId],
    );
    const targetPoints = Number(levelRows[0]?.kpi_target) || 100;
    return { totalPoints, targetPoints };
  }


  @Cron(CronExpression.EVERY_1ST_DAY_OF_MONTH_AT_MIDNIGHT)
  async cronSummarizeLastMonth() {
    const now = new Date();
    const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const year = prevMonth.getFullYear();
    const month = prevMonth.getMonth() + 1;
    this.logger.log(`[CRON] Auto-summarizing KPI for ${year}-${month}`);
    await this.summarizeAll(year, month);
  }
}





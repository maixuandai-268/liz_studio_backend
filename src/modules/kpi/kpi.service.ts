import { Injectable, Logger, NotFoundException, InternalServerErrorException } from '@nestjs/common';
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

  // ── Product Types ──

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

  // ── Monthly rankings ──

  async getMonthlyRanking(year: number, month: number) {
    // Aggregate KPI points per user for the month from employee_kpis
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = new Date(year, month, 0).toISOString().split('T')[0];

    const userId = 'user_id';
    const raw = await this.kpiRecordRepo.manager.connection.query(
      `SELECT ${userId}, SUM(points) as total_points
       FROM employee_kpis
       WHERE achieved_date >= $1 AND achieved_date <= $2
       GROUP BY ${userId}
       ORDER BY total_points DESC`,
      [startDate, endDate],
    );

    const employees = await this.kpiRecordRepo.manager.connection.query(
      `SELECT u.id as user_id, COALESCE(e.full_name, u.full_name) as full_name
       FROM users u
       LEFT JOIN employee e ON e.user_id = u.id`,
    );
    const empMap = new Map(employees.map((e: any) => [Number(e.user_id), e.full_name]));

    const levels = await this.kpiRecordRepo.manager.connection.query(
      `SELECT l.user_id, l.kpi_target FROM level l`,
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
}

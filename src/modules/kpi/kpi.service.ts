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
    const summaries = await this.monthlySummaryRepo.find({
      where: { year, month },
      relations: ['user'] as any,
      order: { totalPoints: 'DESC' } as any,
    });

    return summaries.map((s, i) => ({
      rank: i + 1,
      userId: s.userId,
      fullName: (s.user as any)?.full_name || `User #${s.userId}`,
      totalPoints: Number(s.totalPoints) || 0,
      targetPoints: Number(s.targetPoints) || 0,
      productivityPercent: Number(s.productivityPercent) || 0,
    }));
  }
}

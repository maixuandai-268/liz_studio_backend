import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { KpiProductType } from './entities/kpi-product-type.entity';
import { CreateProductTypeDto } from './dto/create-product-type.dto';
import { UpdateProductTypeDto } from './dto/update-product-type.dto';

@Injectable()
export class KpiService {
  private logger = new Logger('KpiService');

  constructor(
    @InjectRepository(KpiProductType)
    private productTypeRepo: Repository<KpiProductType>,
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
}

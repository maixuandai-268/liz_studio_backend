import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Level } from './entities/levels.entity';

@Injectable()
export class LevelsService implements OnModuleInit {
  private logger = new Logger('LevelsService');

  constructor(
    @InjectRepository(Level)
    private levelRepo: Repository<Level>,
  ) {}

  async findAll(): Promise<Level[]> {
    return this.levelRepo.find({ order: { id: 'ASC' } });
  }

  async findOne(id: number): Promise<Level> {
    const level = await this.levelRepo.findOne({ where: { id } });
    if (!level) throw new Error(`Level ${id} not found`);
    return level;
  }

  async create(dto: Partial<Level>): Promise<Level> {
    const level = this.levelRepo.create(dto);
    const saved = await this.levelRepo.save(level);
    this.logger.log(`[CREATE] Level "${saved.name}" — target: ${saved.kpi_target}`);
    return saved;
  }

  async update(id: number, dto: Partial<Level>): Promise<Level> {
    const level = await this.findOne(id);
    Object.assign(level, dto);
    return this.levelRepo.save(level);
  }

  async remove(id: number): Promise<void> {
    await this.levelRepo.delete(id);
  }

  // ─── Seed default levels ───

  async seedDefaults(): Promise<void> {
    const count = await this.levelRepo.count();
    if (count > 0) {
      this.logger.log(`[SEED] Skipped: ${count} levels exist`);
      return;
    }

    const defaults: Partial<Level>[] = [
      { name: 'Fresher', kpi_target: 6.2, salary_coefficient: 1.0, description: 'Entry level' },
      { name: 'Junior 1', kpi_target: 7.2, salary_coefficient: 1.1, description: 'Junior tier 1' },
      { name: 'Junior 2', kpi_target: 8.4, salary_coefficient: 1.2, description: 'Junior tier 2' },
      { name: 'Pre Mid-Level', kpi_target: 11.6, salary_coefficient: 1.4, description: 'Pre Mid-Level' },
      { name: 'Mid-Level', kpi_target: 15.8, salary_coefficient: 1.6, description: 'Mid-Level' },
      { name: 'Senior', kpi_target: 22.4, salary_coefficient: 2.0, description: 'Senior level' },
    ];

    for (const d of defaults) {
      await this.levelRepo.save(this.levelRepo.create(d));
    }
    this.logger.log(`[SEED] Inserted ${defaults.length} default levels`);
  }

  async onModuleInit() {
    await this.seedDefaults();
  }
}

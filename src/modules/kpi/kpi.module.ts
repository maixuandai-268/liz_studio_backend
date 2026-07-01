import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmployeeKpi } from './entities/employee-kpi.entity';
import { KpiProductType } from './entities/kpi-product-type.entity';
import { KpiMonthlySummary } from './entities/kpi-monthly-summary.entity';
import { KpiController } from './kpi.controller';
import { KpiService } from './kpi.service';

@Module({
  imports: [TypeOrmModule.forFeature([EmployeeKpi, KpiProductType, KpiMonthlySummary])],
  controllers: [KpiController],
  providers: [KpiService],
  exports: [KpiService],
})
export class KpiModule {}


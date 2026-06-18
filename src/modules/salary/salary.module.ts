import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SalaryPeriod } from './entities/salary-periodi.entity';
import { SalaryRecord } from './entities/salary-record.entity';

@Module({
  imports: [TypeOrmModule.forFeature([SalaryPeriod, SalaryRecord])],
})
export class SalaryModule {}

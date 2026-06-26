import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SalaryPeriod } from './entities/salary-periodi.entity';
import { SalaryRecord } from './entities/salary-record.entity';
import { SalaryService } from './salary.service';
import { SalaryController } from './salaryi.controller';
import { Employee } from '@/modules/employee/entities/emplyee.entity';
import { Level } from '@/modules/levels/entities/levels.entity';
import { EmployeeKpi } from '@/modules/kpi/entities/employee-kpi.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([SalaryPeriod, SalaryRecord, Employee, Level, EmployeeKpi]),
  ],
  controllers: [SalaryController],
  providers: [SalaryService],
  exports: [SalaryService],
})
export class SalaryModule {}

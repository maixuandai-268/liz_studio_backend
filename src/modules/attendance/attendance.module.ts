import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AttendanceRecord } from './entities/attendance-records.entity';
import { User } from '../users/entities/user.entity';
import { Employee } from '../employee/entities/emplyee.entity';
import { EmployeeKpi } from '../kpi/entities/employee-kpi.entity';
import { Level } from '../levels/entities/levels.entity';
import { RealtimeModule } from '../realtime/realtime.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AttendanceController } from './attendance.controller';
import { AttendanceService } from './attendance.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([AttendanceRecord, User, Employee, EmployeeKpi, Level]),
    RealtimeModule,
    NotificationsModule,
  ],
  controllers: [AttendanceController],
  providers: [AttendanceService],
  exports: [AttendanceService],
})
export class AttendanceModule {}


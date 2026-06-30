import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Task } from '@/modules/tasks/entities/task.entity';
import { User } from '@/modules/users/entities/user.entity';
import { Employee } from '@/modules/employee/entities/emplyee.entity';
import { AttendanceRecord } from '@/modules/attendance/entities/attendance-records.entity';
import { NotificationsModule } from '@/modules/notifications/notifications.module';
import { CronService } from './cron.service';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    TypeOrmModule.forFeature([Task, User, Employee, AttendanceRecord]),
    NotificationsModule,
  ],
  providers: [CronService],
})
export class CronJobsModule {}

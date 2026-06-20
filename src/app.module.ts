require('dotenv').config();

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

// Modules
import { ActivityLogsModule } from './modules/activity-logs/activity-logs.module';
import { AdminModule } from './modules/admin/admin.module';
import { AttendanceModule } from './modules/attendance/attendance.module';
import { AuthModule } from './modules/auth/auth.module';
import { ChatModule } from './modules/chat/chat.module';
import { EmployeeModule } from './modules/employee/employee.module';
import { KpiModule } from './modules/kpi/kpi.module';
import { LevelsModule } from './modules/levels/levels.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { ProjectModule } from './modules/project/project.module';
import { SalaryModule } from './modules/salary/salary.module';
import { TaskFormsModule } from './modules/task-forms/task-forms.module';
import { RealtimeModule } from './modules/realtime/realtime.module';
import { TaskLogsModule } from './modules/task-logs/task-logs.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { ChannelModule } from './modules/chat/channels/channel.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL,
      autoLoadEntities: true,
      synchronize: true,
      ssl: {
        rejectUnauthorized: false,
      },
    }),
    RealtimeModule,
    TaskLogsModule,
    TasksModule,
    ChatModule,
    AuthModule,
    EmployeeModule,
    AdminModule,
    ProjectModule,
    KpiModule,
    SalaryModule,
    AttendanceModule,
    LevelsModule,
    TaskFormsModule,
    ActivityLogsModule,
    NotificationsModule,
    ChannelModule
  ],
})
export class AppModule {}

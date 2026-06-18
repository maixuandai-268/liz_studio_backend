/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable prettier/prettier */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-require-imports */
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UploadModule } from './modules/upload/upload.module';
import { ProjectModule } from './modules/project/project.module';
import { UsersModule } from './modules/users/users.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { AuthModule } from './modules/auth/auth.module';
import { AdminModule } from './modules/admin/admin.module';
import { EmployeeModule } from './modules/employee/employee.module';
import { LevelsModule } from './modules/levels/levels.module';
import { AttendanceModule } from './modules/attendance/attendance.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { KpiModule } from './modules/kpi/kpi.module';
import { SalaryModule } from './modules/salary/salary.module';
import { ChatModule } from './modules/chat/chat.module';
import { ActivityLogsModule } from './modules/activity-logs/activity-logs.module';
import { TaskFormsModule } from './modules/task-forms/task-forms.module';
require('dotenv').config();

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
    UsersModule,
    UploadModule,
    ProjectModule,
    NotificationsModule,
    AuthModule,
    AdminModule,
    EmployeeModule,
    LevelsModule,
    AttendanceModule,
    TasksModule,
    KpiModule,
    SalaryModule,
    ChatModule,
    ActivityLogsModule,
    TaskFormsModule,
  ],
})
export class AppModule { };

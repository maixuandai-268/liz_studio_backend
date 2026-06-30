import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Task } from './entities/task.entity';
import { TaskAssignee } from './entities/task-assignee.entity';
import { TaskComment } from './entities/task-comment.entity';
import { TaskAttachment } from './entities/task-attachment.entity';
import { TaskActivity } from './entities/task-activity.entity';
import { TaskKpiAllocation } from './entities/task-kpi-allocation.entity';
import { TaskPhaseApproval } from './entities/task-phase-approval.entity';
import { TaskChecklist } from './entities/task-checklist.entity';
import { TasksService } from './tasks.service';
import { RealtimeModule } from '@/modules/realtime/realtime.module';
import { TaskLogsModule } from '@/modules/task-logs/task-logs.module';
import { KpiModule } from '@/modules/kpi/kpi.module';
import { Task_Categories } from './entities/categories.entity';
import { Projects } from '../projects/entities/project.entity';
import { Employee } from '../employee/entities/emplyee.entity';
import { TaskController } from './tasks.controller';
import { TaskCommentsController } from './sub-resources/task-comments.controller';
import { TaskChecklistController } from './sub-resources/task-checklist.controller';
import { NotificationsModule } from '@/modules/notifications/notifications.module';
import { TasksChecklistsService } from './sub-resources/tasks-checklists.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Task,
      TaskAssignee,
      TaskComment,
      TaskAttachment,
      TaskActivity,
      TaskChecklist,
      Task_Categories,
      TaskKpiAllocation,
      TaskPhaseApproval,
      Projects,
      Employee
    ]),
    RealtimeModule,
    TaskLogsModule,
    KpiModule,
    NotificationsModule,
  ],
  controllers: [TaskController, TaskCommentsController, TaskChecklistController],
  providers: [TasksService, TasksChecklistsService, TaskCommentsService],
  exports: [TasksService, TasksChecklistsService],
})
export class TasksModule {}

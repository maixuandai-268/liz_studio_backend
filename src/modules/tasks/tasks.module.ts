import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Task } from './entities/task.entity';
import { TaskAssignee } from './entities/task-assignee.entity';
import { TaskComment } from './entities/task-comment.entity';
import { TaskAttachment } from './entities/task-attachment.entity';
import { TaskActivity } from './entities/task-activity.entity';
import { TaskChecklist } from './entities/task-checklist.entity';
import { TasksService } from './tasks.service';
import { RealtimeModule } from '@/modules/realtime/realtime.module';
import { TaskLogsModule } from '@/modules/task-logs/task-logs.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Task,
      TaskAssignee,
      TaskComment,
      TaskAttachment,
      TaskActivity,
      TaskChecklist,
    ]),
    RealtimeModule,
    TaskLogsModule,
  ],
  providers: [TasksService],
  exports: [TasksService],
})
export class TasksModule {}

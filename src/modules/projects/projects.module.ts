/* eslint-disable prettier/prettier */
import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProjectController } from './projects.controller';
import { ProjectService } from './projects.service';
import { Task } from '../tasks/entities/task.entity';
import { Projects } from './entities/project.entity';
import { Task_Categories } from '../tasks/entities/categories.entity';
import { ChatModule } from '@/modules/chat/chat.module';
import { NotificationsModule } from '@/modules/notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Projects, Task, Task_Categories]),
    forwardRef(() => ChatModule),
    NotificationsModule
  ],
  controllers: [ProjectController],
  providers: [ProjectService],
  exports: [ProjectService],
})
export class ProjectsModule {}
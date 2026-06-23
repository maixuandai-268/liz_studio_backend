/* eslint-disable prettier/prettier */
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProjectController } from './projects.controller';
import { ProjectService } from './projects.service';
import { Task } from '../tasks/entities/task.entity';
import { Projects } from './entities/project.entity';
import { Task_Categories } from '../tasks/entities/categories.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Projects,Task,Task_Categories])],
  controllers: [ProjectController],
  providers: [ProjectService],
})
export class ProjectsModule {}
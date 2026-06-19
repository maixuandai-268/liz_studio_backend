import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Task } from './entities/task.entity';
import { RealtimeService } from '@/modules/realtime/realtime.service';
import { TaskLogsService } from '@/modules/task-logs/task-logs.service';

@Injectable()
export class TasksService {
  private logger = new Logger('TasksService');

  constructor(
    @InjectRepository(Task)
    private taskRepository: Repository<Task>,
    private realtimeService: RealtimeService,
    private taskLogsService: TaskLogsService,
  ) {}

  async createTask(projectId: string, createTaskDto: any) {
    try {
      const projectIdNum = parseInt(projectId, 10);

      const task = this.taskRepository.create({
        ...createTaskDto,
        project_id: projectIdNum,
      } as any);

      const saved = (await this.taskRepository.save(task)) as unknown as Task;

      this.realtimeService.emitTaskEvent(projectId, 'created', {
        id: saved.id,
        title: saved.title,
        description: saved.description,
        status: saved.status,
        priority: saved.priority,
        createdAt: saved.createdAt,
      });

      this.logger.log(`[TASK] Created: ${saved.id} in project ${projectId}`);
      return saved;
    } catch (error) {
      this.logger.error(`[TASK] Create failed: ${error.message}`);
      throw error;
    }
  }

  async getTask(projectId: string, taskId: string) {
    const projectIdNum = parseInt(projectId, 10);
    const taskIdNum = parseInt(taskId, 10);

    const task = await this.taskRepository.findOne({
      where: {
        id: taskIdNum,
        project_id: projectIdNum,
      } as any,
    });

    if (!task) {
      throw new NotFoundException(`Task ${taskId} not found`);
    }

    return task;
  }

  async getProjectTasks(projectId: string) {
    const projectIdNum = parseInt(projectId, 10);

    return this.taskRepository.find({
      where: {
        project_id: projectIdNum,
      } as any,
      order: {
        createdAt: 'DESC',
      } as any,
    });
  }

  async updateTask(
    projectId: string,
    taskId: string,
    updateTaskDto: any,
    userId?: string,
    userName?: string,
  ) {
    try {
      const task = await this.getTask(projectId, taskId);
      const oldValues = { ...task };

      Object.assign(task, updateTaskDto);
      const updated = (await this.taskRepository.save(task)) as Task;

      const changes = [];
      for (const key of Object.keys(updateTaskDto)) {
        if (oldValues[key] !== updateTaskDto[key]) {
          changes.push({
            field: key,
            oldValue: oldValues[key],
            newValue: updateTaskDto[key],
          });
        }
      }

      await this.taskLogsService.createLog(
        projectId,
        taskId,
        'updated',
        userId || 'system',
        userName || 'System',
        changes,
      );

      this.realtimeService.emitTaskEvent(projectId, 'updated', {
        id: updated.id,
        title: updated.title,
        description: updated.description,
        status: updated.status,
        priority: updated.priority,
        updatedAt: updated.updatedAt,
      });

      this.logger.log(
        `[TASK] Updated: ${updated.id} in project ${projectId}`,
      );
      return updated;
    } catch (error) {
      this.logger.error(`[TASK] Update failed: ${error.message}`);
      throw error;
    }
  }

  async moveTask(
    projectId: string,
    taskId: string,
    moveDto: { status: string },
  ) {
    try {
      const task = await this.getTask(projectId, taskId);
      const oldStatus = task.status;

      task.status = moveDto.status;

      const updated = (await this.taskRepository.save(task)) as unknown as Task;

      this.realtimeService.emitTaskEvent(projectId, 'moved', {
        id: updated.id,
        title: updated.title,
        oldStatus,
        newStatus: updated.status,
        movedAt: new Date().toISOString(),
      });

      this.logger.log(
        `[TASK] Moved: ${updated.id} from ${oldStatus} to ${updated.status}`,
      );
      return updated;
    } catch (error) {
      this.logger.error(`[TASK] Move failed: ${error.message}`);
      throw error;
    }
  }

  async deleteTask(projectId: string, taskId: string) {
    try {
      const task = await this.getTask(projectId, taskId);

      await this.taskRepository.remove(task);

      this.realtimeService.emitTaskEvent(projectId, 'deleted', {
        id: taskId,
        title: task.title,
        deletedAt: new Date().toISOString(),
      });

      this.logger.log(
        `[TASK] Deleted: ${taskId} from project ${projectId}`,
      );
      return { success: true };
    } catch (error) {
      this.logger.error(`[TASK] Delete failed: ${error.message}`);
      throw error;
    }
  }
}

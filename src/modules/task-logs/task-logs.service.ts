import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TaskLog } from './entities/task-log.entity';
import { RealtimeService } from '@/modules/realtime/realtime.service';

@Injectable()
export class TaskLogsService {
  private logger = new Logger('TaskLogsService');

  constructor(
    @InjectRepository(TaskLog)
    private taskLogRepository: Repository<TaskLog>,
    private realtimeService: RealtimeService,
  ) {}

  async createLog(
    projectId: string,
    taskId: string,
    action: string,
    userId: string,
    userName: string,
    changes?: any,
  ) {
    try {
      const taskIdNum = parseInt(taskId, 10);

      const log = this.taskLogRepository.create({
        taskId: taskIdNum,
        projectId,
        action: action as any,
        userId,
        userName,
        changes,
      } as any);

      const saved = (await this.taskLogRepository.save(log)) as unknown as TaskLog;

      this.realtimeService.emitTimelineEvent(projectId, {
        id: saved.id,
        taskId,
        action,
        userName,
        changes,
        createdAt: saved.createdAt,
      });

      this.logger.log(
        `[TIMELINE] Created log for task ${taskId}: ${action}`,
      );
      return saved;
    } catch (error) {
      this.logger.error(`[TIMELINE] Create log failed: ${error.message}`);
      throw error;
    }
  }

  async getTaskTimeline(projectId: string, taskId: string) {
    const taskIdNum = parseInt(taskId, 10);
    return this.taskLogRepository.find({
      where: {
        projectId,
        taskId: taskIdNum,
      } as any,
      order: {
        createdAt: 'DESC',
      } as any,
    });
  }

  async getProjectTimeline(projectId: string, limit = 50) {
    return this.taskLogRepository.find({
      where: { projectId } as any,
      order: { createdAt: 'DESC' } as any,
      take: limit,
    });
  }
}

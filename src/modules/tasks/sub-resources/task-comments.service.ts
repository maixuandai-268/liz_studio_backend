import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TaskComment } from '../entities/task-comment.entity';
import { NotificationTriggersService } from '@/modules/notifications/notification-triggers.service';
import { Task } from '../entities/task.entity';
import { User } from '@/modules/users/entities/user.entity';

@Injectable()
export class TaskCommentsService {
  private logger = new Logger('TaskCommentsService');
  
  constructor(
    @InjectRepository(TaskComment)
    private commentRepo: Repository<TaskComment>,
    @InjectRepository(Task)
    private taskRepo: Repository<Task>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
    private notificationTriggers: NotificationTriggersService,
  ) {}

  async findAll(taskId: number) {
    return this.commentRepo.find({
      where: { taskId } as any,
      order: { createdAt: 'ASC' },
      relations: { user: { employee: true } } as any,
    });
  }

  async create(taskId: number, userId: number, content: string) {
    const comment = this.commentRepo.create({ taskId, userId, content } as any);
    const saved = await this.commentRepo.save(comment);

    // Fire notification to admin
    this.fireCommentNotif(taskId, userId).catch(e => this.logger.error(`[NOTIF] ${e.message}`));

    return saved;
  }

  private async fireCommentNotif(taskId: number, userId: number) {
    try {
      const task = await this.taskRepo.findOne({ where: { id: taskId } as any });
      const user = await this.userRepo.findOne({ where: { id: userId }, relations: { employee: true } as any });
      if (!task || !user) return;
      
      const userName = user.employee?.full_name || 'Unknown';
      await this.notificationTriggers.taskComment(task.title || `Task #${taskId}`, userName);
    } catch(e) {
      this.logger.error(`[NOTIF-COMMENT] ${(e as any).message}`);
    }
  }
}

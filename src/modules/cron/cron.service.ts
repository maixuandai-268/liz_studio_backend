import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, MoreThan, Not, IsNull } from 'typeorm';
import { Task } from '@/modules/tasks/entities/task.entity';
import { User } from '@/modules/users/entities/user.entity';
import { AttendanceRecord } from '@/modules/attendance/entities/attendance-records.entity';
import { NotificationTriggersService } from '@/modules/notifications/notification-triggers.service';

@Injectable()
export class CronService {
  private logger = new Logger('CronService');

  constructor(
    @InjectRepository(Task)
    private taskRepo: Repository<Task>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @InjectRepository(AttendanceRecord)
    private attendanceRepo: Repository<AttendanceRecord>,
    private notificationTriggers: NotificationTriggersService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_8AM, { timeZone: 'Asia/Ho_Chi_Minh' })
  async handleTaskReminders() {
    this.logger.log('[CRON] Running handleTaskReminders...');
    const now = new Date();
    const oneDayFromNow = new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000);

    const tasks = await this.taskRepo.find({
      where: {
        due_date: LessThan(oneDayFromNow),
        status: Not('done'),
        priority: Not('urgent'),
      },
      relations: {
        task_assignees: true,
        project: true,
      },
    });
    
    this.logger.log(`[CRON] Found ${tasks.length} tasks to set as urgent.`);

    for (const task of tasks) {
      this.logger.log(`[CRON] Processing task ID: ${task.id}`);
      task.priority = 'urgent';
      await this.taskRepo.save(task as any);
      
      for (const assignee of (task as any).task_assignees) {
        const user = await this.userRepo.findOne({ where: { id: assignee.userId }});
        if (user) {
          this.logger.log(`[CRON] Found user ${user.id} (${user.email}) for task ${task.id}. Triggering notification.`);
          this.notificationTriggers.taskBecameUrgent(
            task.title,
            (task as any).project.projectName,
            assignee.userId,
            user.email,
          ).catch(e => this.logger.error(`[CRON-NOTIF-ERROR] For task ${task.id}: ${e.message}`));
        } else {
          this.logger.warn(`[CRON] User not found for assignee with userId: ${assignee.userId}`);
        }
      }
    }
    this.logger.log('[CRON] Finished handleTaskReminders.');
  }

  @Cron('15 8 * * 1-6', { timeZone: 'Asia/Ho_Chi_Minh' })
  async handleCheckInReminders() {
    this.logger.log('Running check-in reminders...');
    const today = new Date().toISOString().split('T')[0];
    const users = await this.userRepo.find({ where: { isActive: true }, relations: { employee: true }});
    
    for (const user of users) {
      const checkedIn = await this.attendanceRepo.count({ where: { userId: user.id, attendanceDate: today } as any });
      if (checkedIn === 0) {
        this.notificationTriggers.remindCheckIn(
          user.id,
          user.employee?.full_name || 'User',
          user.email,
        ).catch(e => this.logger.error(`[NOTIF-CRON-CHECKIN] ${e.message}`));
      }
    }
  }

  @Cron('0 18 * * 1-6', { timeZone: 'Asia/Ho_Chi_Minh' }) 
  async handleCheckOutReminders() {
    this.logger.log('Running check-out reminders...');
    const today = new Date().toISOString().split('T')[0];
    const users = await this.userRepo.find({ where: { isActive: true }, relations: { employee: true }});
    
    for (const user of users) {
      const record = await this.attendanceRepo.findOne({ where: { userId: user.id, attendanceDate: today, checkOut: IsNull() } as any });
      if (record) {
        this.notificationTriggers.remindCheckOut(
          user.id,
          user.employee?.full_name || 'User',
          user.email,
        ).catch(e => this.logger.error(`[NOTIF-CRON-CHECKOUT] ${e.message}`));
      }
    }
  }
}


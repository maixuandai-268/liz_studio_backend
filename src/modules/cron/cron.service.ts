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
    this.logger.log('Running daily task reminders...');
    const now = new Date();
    const twoDaysFromNow = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);

    const tasks = await this.taskRepo.find({
      where: {
        due_date: LessThan(twoDaysFromNow),
        status: Not('done'),
      },
      relations: ['assignees', 'project'],
    });

    for (const task of tasks) {
      task.priority = 'Khẩn cấp';
      await this.taskRepo.save(task as any);
      
      for (const assignee of (task as any).assignees) {
        const user = await this.userRepo.findOne({ where: { id: assignee.userId }});
        if (user) {
          this.notificationTriggers.taskBecameUrgent(
            task.title,
            (task as any).project.projectName,
            assignee.userId,
            user.email,
          ).catch(e => this.logger.error(`[NOTIF-CRON] ${e.message}`));
        }
      }
    }
  }

  @Cron('15 8 * * 1-6', { timeZone: 'Asia/Ho_Chi_Minh' }) // 8:15 AM Mon-Sat
  async handleCheckInReminders() {
    this.logger.log('Running check-in reminders...');
    const today = new Date().toISOString().split('T')[0];
    const users = await this.userRepo.find({ where: { isActive: true }, relations: ['employee']});
    
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

  @Cron('0 18 * * 1-6', { timeZone: 'Asia/Ho_Chi_Minh' }) // 6:00 PM Mon-Sat
  async handleCheckOutReminders() {
    this.logger.log('Running check-out reminders...');
    const today = new Date().toISOString().split('T')[0];
    const users = await this.userRepo.find({ where: { isActive: true }, relations: ['employee']});
    
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

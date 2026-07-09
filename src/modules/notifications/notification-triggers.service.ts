/* eslint-disable prettier/prettier */
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification, NotificationType } from './entities/notification.entity';
import { RealtimeService } from '@/modules/realtime/realtime.service';
import { MailService } from './mail.service';

@Injectable()
export class NotificationTriggersService {
  private logger = new Logger('NotificationTriggers');

  constructor(
    @InjectRepository(Notification)
    private notifRepo: Repository<Notification>,
    private realtimeService: RealtimeService,
    private mailService: MailService,
  ) {}

  private async create(params: {
    userId: number;
    type: NotificationType;
    message: string;
    email?: string;
    emailTitle?: string;
  }): Promise<Notification> {
    this.logger.log(`[NOTIF] Creating notification for user ${params.userId}: ${params.emailTitle} | email: ${params.email || 'none'}`);

    const notif = this.notifRepo.create({
      userId: params.userId,
      type: params.type,
      message: params.message,
    });
    const saved = await this.notifRepo.save(notif);

    this.realtimeService.emitNotification(String(params.userId), saved);

    if (params.email && params.emailTitle) {
      this.logger.log(`[NOTIF] Attempting to send email to ${params.email} with title "${params.emailTitle}"`);
      try {
        await this.mailService.sendNotification(
          params.email,
          params.emailTitle,
          params.message,
        );
        this.logger.log(`[NOTIF] Email sent successfully to ${params.email}: ${params.emailTitle}`);
      } catch (err) {
        this.logger.error(`[NOTIF] Failed to send email to ${params.email}: ${(err as any).message}`);
      }
    } else {
      this.logger.warn(`[NOTIF] Email NOT sent because: email=${params.email ? 'present' : 'missing'}, emailTitle=${params.emailTitle ? 'present' : 'missing'}`);
    }

    return saved;
  }

  async createForMany(
    items: { userId: number; email?: string }[],
    type: NotificationType,
    message: string,
    emailTitle?: string,
  ) {
    // Batch save all notifications first, then emit concurrently
    const notifs = this.notifRepo.create(
      items.map(item => ({
        userId: item.userId,
        type,
        message,
      }))
    );
    const saved = await this.notifRepo.save(notifs);

    await Promise.all(items.map((item, i) => {
      this.realtimeService.emitNotification(String(item.userId), saved[i]);
      if (item.email && emailTitle) {
        return this.mailService.sendNotification(item.email, emailTitle, message).catch(() => {});
      }
    }));
  }


  async taskCompleted(taskTitle: string, projectName: string, employeeName: string, completedAt?: string) {
    const timeStr = completedAt ? ` - ${completedAt}` : '';
    const message = `Task "${taskTitle}" (${projectName}) đã hoàn thành bởi ${employeeName}${timeStr}`;
    this.logger.log(`[NOTIF] taskCompleted: "${taskTitle}"`);
    await this.createForAdmin(NotificationType.SUCCESS, message, 'Task Hoàn Thành');
  }

  async taskOverdue(taskTitle: string, projectName: string, assigneeId: number, assigneeEmail?: string, assigneeName?: string) {
    const message = `Task "${taskTitle}" (${projectName}) đã quá hạn hoàn thành! Cần hoàn thành gấp.`;
    const title = 'Task Quá Hạn';
    this.logger.log(`[NOTIF] taskOverdue for user ${assigneeId}: "${taskTitle}"`);
    await this.create({
      userId: assigneeId,
      type: NotificationType.ERROR,
      message,
      email: assigneeEmail,
      emailTitle: title,
    });
    const adminMsg = `Task "${taskTitle}" (${projectName}) của ${assigneeName || '#' + assigneeId} đã quá hạn!`;
    await this.createForAdmin(NotificationType.ERROR, adminMsg, 'Task Quá Hạn (Admin)');
  }

  async newTaskAssigned(taskTitle: string, projectName: string, deadline: string, priority: string, assigneeId: number, assigneeEmail?: string) {
    const message = `Task mới: "${taskTitle}" - ${projectName}\nHạn hoàn thành: ${deadline} - Mức độ: ${priority}`;
    const title = 'Task Mới Được Giao';
    this.logger.log(`[NOTIF] newTaskAssigned for user ${assigneeId}: "${taskTitle}"`);
    await this.create({
      userId: assigneeId,
      type: NotificationType.INFO,
      message,
      email: assigneeEmail,
      emailTitle: title,
    });
  }

  async taskBecameUrgent(taskTitle: string, projectName: string, assigneeId: number, assigneeEmail?: string) {
    const message = `Task "${taskTitle}" (${projectName}) đã chuyển sang mức độ Khẩn cấp! Cần hoàn thành gấp.`;
    const title = 'Task Khẩn Cấp';
    this.logger.log(`[NOTIF] taskBecameUrgent called for task "${taskTitle}", assignee ${assigneeId}, email: ${assigneeEmail || 'none'}`);
    await this.create({
      userId: assigneeId,
      type: NotificationType.WARNING,
      message,
      email: assigneeEmail,
      emailTitle: title,
    });
  }

  async taskRevisionRequested(taskTitle: string, adminName: string, reason: string, employeeId: number, employeeEmail?: string) {
    const message = `Yêu cầu sửa task "${taskTitle}" từ ${adminName}\nLý do: ${reason || 'Không có lý do'}`;
    const title = 'Yêu Cầu Sửa Task';
    this.logger.log(`[NOTIF] taskRevisionRequested for user ${employeeId}: "${taskTitle}"`);
    await this.create({
      userId: employeeId,
      type: NotificationType.WARNING,
      message,
      email: employeeEmail,
      emailTitle: title,
    });
  }

  async taskComment(taskTitle: string, employeeName: string, commentContent: string) {
    const preview = commentContent.length > 120 ? commentContent.substring(0, 120) + '...' : commentContent;
    const message = `${employeeName} đã comment trong task "${taskTitle}": "${preview}"`;
    this.logger.log(`[NOTIF] taskComment: "${taskTitle}"`);
    await this.createForAdmin(NotificationType.INFO, message, 'Comment Mới');
  }

  async projectCompleted(projectName: string) {
    const message = `Project "${projectName}" đã hoàn thành!`;
    this.logger.log(`[NOTIF] projectCompleted: "${projectName}"`);
    await this.createForAdmin(NotificationType.SUCCESS, message, 'Project Hoàn Thành');
  }


  async lateCheckIn(employeeName: string, reason: string) {
    const message = `${employeeName} chấm công muộn.${reason ? ` Lý do: ${reason}` : ''}`;
    this.logger.log(`[NOTIF] lateCheckIn: ${employeeName}`);
    await this.createForAdmin(NotificationType.WARNING, message, 'Chấm Công Muộn');
  }

  async remindCheckIn(userId: number, userName: string, email?: string) {
    const message = `${userName} ơi, bạn chưa check-in hôm nay! Đã quá 15 phút.`;
    const title = 'Nhắc Nhở Chấm Công';
    this.logger.log(`[NOTIF] remindCheckIn for user ${userId}: ${userName}, email: ${email || 'none'}`);
    await this.create({
      userId,
      type: NotificationType.WARNING,
      message,
      email,
      emailTitle: title,
    });
  }

  async remindCheckOut(userId: number, userName: string, email?: string) {
    const message = `${userName} ơi, đã đến giờ về! Đừng quên check-out.`;
    const title = 'Nhắc Nhở Check-out';
    this.logger.log(`[NOTIF] remindCheckOut for user ${userId}: ${userName}, email: ${email || 'none'}`);
    await this.create({
      userId,
      type: NotificationType.WARNING,
      message,
      email,
      emailTitle: title,
    });
  }


  async chatMessage(senderName: string, content: string, targetUserId: number) {
    const preview = content.length > 60 ? content.substring(0, 60) + '...' : content;
    const message = `${senderName}: ${preview}`;
    const title = `Tin nhắn từ ${senderName}`;
    this.logger.log(`[NOTIF] chatMessage (NO EMAIL) for user ${targetUserId}`);
    await this.create({
      userId: targetUserId,
      type: NotificationType.INFO,
      message,
    });
  }

  async chatMessageGroup(senderName: string, groupName: string, content: string, targetUserId: number, targetEmail: string) {
    const preview = content.length > 60 ? content.substring(0, 60) + '...' : content;
    const message = `${senderName} đã nhắn trong ${groupName}: ${preview}`;
    const title = `Tin nhắn mới trong ${groupName}`;
    this.logger.log(`[NOTIF] chatMessageGroup (WITH EMAIL) for user ${targetUserId}`);
    await this.create({
      userId: targetUserId,
      type: NotificationType.INFO,
      message,
      email: targetEmail,
      emailTitle: title,
    });
  }


  async salaryApproved(employeeId: number, employeeName: string, email?: string) {
    const message = `Bảng lương của ${employeeName} đã được duyệt!`;
    const title = 'Bảng Lương Đã Duyệt';
    this.logger.log(`[NOTIF] salaryApproved for user ${employeeId}: ${employeeName}, email: ${email || 'none'}`);
    await this.create({
      userId: employeeId,
      type: NotificationType.SUCCESS,
      message,
      email,
      emailTitle: title,
    });
  }


  private async createForAdmin(type: NotificationType, message: string, title: string) {
    try {
      const adminUsers = await this.notifRepo.manager.connection.query(
        `SELECT u.id, u.email FROM users u WHERE u.role = 'admin'`,
      );
      if (adminUsers.length === 0) return;

      // Batch save all admin notifications
      const notifs = this.notifRepo.create(
        adminUsers.map((admin: any) => ({
          userId: Number(admin.id),
          type,
          message,
        }))
      );
      const saved = await this.notifRepo.save(notifs);

      // Emit + email concurrently
      await Promise.all(adminUsers.map((admin: any, i: number) => {
        this.realtimeService.emitNotification(String(admin.id), saved[i]);
        if (admin.email) {
          return this.mailService.sendNotification(admin.email, title, message).catch(() => {});
        }
      }));
    } catch (err) {
      this.logger.error(`[NOTIF] createForAdmin failed: ${(err as any).message}`);
    }
  }
}


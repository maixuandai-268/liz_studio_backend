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
    const notif = this.notifRepo.create({
      userId: params.userId,
      type: params.type,
      message: params.message,
    });
    const saved = await this.notifRepo.save(notif);

    // Emit realtime
    this.realtimeService.emitNotification(String(params.userId), saved);

    // Send email if email provided
    if (params.email) {
      await this.mailService.sendNotification(
        params.email,
        params.emailTitle || 'Thông báo',
        params.message,
      );
    }

    return saved;
  }

  async createForMany(
    items: { userId: number; email?: string }[],
    type: NotificationType,
    message: string,
    emailTitle?: string,
  ) {
    for (const item of items) {
      await this.create({
        userId: item.userId,
        type,
        message,
        email: item.email,
        emailTitle,
      });
    }
  }

  // ───── TASK EVENTS ─────

  async taskCompleted(taskTitle: string, projectName: string, employeeName: string) {
    const message = `Task "${taskTitle}" (${projectName}) đã hoàn thành bởi ${employeeName}`;
    // Gửi cho admin (userId = 1, hoặc lấy admin users)
    await this.createForAdmin(NotificationType.SUCCESS, message, 'Task hoàn thành');
  }

  async taskOverdue(taskTitle: string, projectName: string, assigneeId: number, assigneeEmail?: string) {
    const message = `Task "${taskTitle}" (${projectName}) đã quá hạn hoàn thành!`;
    await this.create({
      userId: assigneeId,
      type: NotificationType.ERROR,
      message,
      email: assigneeEmail,
      emailTitle: 'Task quá hạn',
    });
    // Cũng thông báo admin
    await this.createForAdmin(NotificationType.ERROR, `Task "${taskTitle}" (${projectName}) quá hạn!`, 'Task quá hạn');
  }

  async newTaskAssigned(taskTitle: string, projectName: string, deadline: string, priority: string, assigneeId: number, assigneeEmail?: string) {
    const message = `Task mới: "${taskTitle}" - ${projectName} - Hạn: ${deadline} - Mức độ: ${priority}`;
    await this.create({
      userId: assigneeId,
      type: NotificationType.INFO,
      message,
      email: assigneeEmail,
      emailTitle: 'Task mới được giao',
    });
  }

  async taskBecameUrgent(taskTitle: string, projectName: string, assigneeId: number, assigneeEmail?: string) {
    const message = `Task "${taskTitle}" (${projectName}) chuyển sang mức độ Khẩn cấp!`;
    await this.create({
      userId: assigneeId,
      type: NotificationType.WARNING,
      message,
      email: assigneeEmail,
      emailTitle: 'Task khẩn cấp',
    });
  }

  async taskRevisionRequested(taskTitle: string, adminName: string, employeeId: number, employeeEmail?: string) {
    const message = `${adminName} yêu cầu sửa task "${taskTitle}"`;
    await this.create({
      userId: employeeId,
      type: NotificationType.WARNING,
      message,
      email: employeeEmail,
      emailTitle: 'Yêu cầu sửa task',
    });
  }

  async taskComment(taskTitle: string, employeeName: string) {
    const message = `${employeeName} đã comment trong task "${taskTitle}"`;
    await this.createForAdmin(NotificationType.INFO, message, 'Comment mới');
  }

  async projectCompleted(projectName: string) {
    const message = `Project "${projectName}" đã hoàn thành!`;
    await this.createForAdmin(NotificationType.SUCCESS, message, 'Project hoàn thành');
  }

  // ───── ATTENDANCE EVENTS ─────

  async lateCheckIn(employeeName: string, reason: string) {
    const message = `${employeeName} chấm công muộn. Lý do: ${reason || 'Không có lý do'}`;
    await this.createForAdmin(NotificationType.WARNING, message, 'Chấm công muộn');
  }

  async remindCheckIn(userId: number, userName: string, email?: string) {
    const message = `${userName} ơi, bạn chưa check-in! Đã quá 15 phút.`;
    await this.create({
      userId,
      type: NotificationType.WARNING,
      message,
      email,
      emailTitle: 'Nhắc chấm công',
    });
  }

  async remindCheckOut(userId: number, userName: string, email?: string) {
    const message = `${userName} ơi, đã đến giờ về! Đừng quên check-out.`;
    await this.create({
      userId,
      type: NotificationType.WARNING,
      message,
      email,
      emailTitle: 'Nhắc check-out',
    });
  }

  // ───── CHAT EVENTS ─────

  async chatMessage(senderName: string, content: string, targetUserId: number, targetEmail?: string) {
    const preview = content.length > 60 ? content.substring(0, 60) + '...' : content;
    const message = `${senderName}: ${preview}`;
    await this.create({
      userId: targetUserId,
      type: NotificationType.INFO,
      message,
      email: targetEmail,
      emailTitle: `Tin nhắn từ ${senderName}`,
    });
  }

  // ───── SALARY EVENTS ─────

  async salaryApproved(employeeId: number, employeeName: string, email?: string) {
    const message = `Bảng lương của ${employeeName} đã được duyệt!`;
    await this.create({
      userId: employeeId,
      type: NotificationType.SUCCESS,
      message,
      email,
      emailTitle: 'Bảng lương đã duyệt',
    });
  }

  // ───── HELPERS ─────

  private async createForAdmin(type: NotificationType, message: string, emailTitle: string) {
    const adminUsers = await this.notifRepo.manager.connection.query(
      `SELECT u.id, u.email FROM users u WHERE u.role = 'admin'`,
    );
    for (const admin of adminUsers) {
      await this.create({
        userId: Number(admin.id),
        type,
        message,
        email: admin.email || undefined,
        emailTitle,
      });
    }
  }
}

/* eslint-disable prettier/prettier */
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from './entities/notification.entity';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
  ) {}

  async create(data: Partial<Notification>): Promise<Notification> {
    const notification = this.notificationRepository.create(data);
    return await this.notificationRepository.save(notification);
  }

  async findAllByUser(userId: number): Promise<Notification[]> {
    return await this.notificationRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async findAllByUserPaginated(
    userId: number,
    page: number = 1,
    limit: number = 6,
  ): Promise<{ data: Notification[]; total: number; unreadCount: number; page: number; totalPages: number }> {
    const [data, total] = await this.notificationRepository.findAndCount({
      where: { userId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    const unreadCount = await this.notificationRepository.count({
      where: { userId, isRead: false },
    });

    return {
      data,
      total,
      unreadCount,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getUnreadCount(userId: number): Promise<number> {
    return this.notificationRepository.count({
      where: { userId, isRead: false },
    });
  }

  async markAsRead(id: number): Promise<Notification> {
    const notification = await this.notificationRepository.findOne({ where: { id } });
    if (!notification) {
      throw new NotFoundException(`Không tìm thấy thông báo với ID: ${id}`);
    }
    notification.isRead = true;
    return await this.notificationRepository.save(notification);
  }

  async markAllAsRead(userId: number): Promise<void> {
    await this.notificationRepository.update({ userId, isRead: false }, { isRead: true });
  }

  async delete(id: number): Promise<void> {
    await this.notificationRepository.delete(id);
  }
}


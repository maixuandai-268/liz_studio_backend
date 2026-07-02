/* eslint-disable prettier/prettier */
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Notification } from './entities/notification.entity';
import { CursorQueryDto, PaginatedResponseDto } from '@/common/dto/pagination.dto';
import { CursorService } from '@/common/services/cursor.service';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
    private readonly cursorService: CursorService,
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

  async findNotificationsWithCursor(
    userId: number,
    query: CursorQueryDto,
  ): Promise<PaginatedResponseDto<Notification>> {
    const limit = Math.min(query.limit || 20, 100);
    const cursor = query.cursor ? this.cursorService.decode(query.cursor) : null;

    const qb = this.notificationRepository
      .createQueryBuilder('notification')
      .where('notification.userId = :userId', { userId })
      .orderBy('notification.createdAt', 'DESC')
      .addOrderBy('notification.id', 'DESC')
      .limit(limit + 1);

    if (cursor) {
      qb.andWhere('(notification.createdAt, notification.id) < (:createdAt, :id)', {
        createdAt: new Date(cursor.createdAt),
        id: cursor.id,
      });
    }

    const items = await qb.getMany();

    const hasMore = items.length > limit;
    if (hasMore) {
      items.pop();
    }

    const nextCursor =
      items.length > 0
        ? this.cursorService.encode({
            createdAt: items[items.length - 1].createdAt.toISOString(),
            id: items[items.length - 1].id,
          })
        : null;

    return {
      items,
      nextCursor,
      hasMore,
    };
  }

  async markManyAsRead(ids: number[]): Promise<{ success: boolean; updatedCount: number }> {
    const result = await this.notificationRepository.update(
      { id: In(ids) },
      { isRead: true },
    );
    return { success: true, updatedCount: result.affected || 0 };
  }
}


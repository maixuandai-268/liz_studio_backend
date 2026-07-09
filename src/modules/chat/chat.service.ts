import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Message } from './entities/message.entity';
import { ChatRoom } from './entities/chat-room.entity';
import { ChatParticipant } from './entities/chat-participant.entity';
import { RealtimeService } from '@/modules/realtime/realtime.service';
import { NotificationTriggersService } from '@/modules/notifications/notification-triggers.service';
import { User } from '@/modules/users/entities/user.entity';
import { CursorQueryDto, PaginatedResponseDto } from '@/common/dto/pagination.dto';
import { CursorService } from '@/common/services/cursor.service';
import { MessageDto } from './dto/message.dto';

@Injectable()
export class ChatService {
  private logger = new Logger('ChatService');

  constructor(
    @InjectRepository(Message)
    private messageRepository: Repository<Message>,
    @InjectRepository(ChatRoom)
    private chatRoomRepository: Repository<ChatRoom>,
    @InjectRepository(ChatParticipant)
    private participantRepository: Repository<ChatParticipant>,
    private realtimeService: RealtimeService,
    private notificationTriggers: NotificationTriggersService,
    @InjectRepository(User)
    private userRepo: Repository<User>,
    private cursorService: CursorService,
  ) {}

  private async fireChatNotif(roomId: number, senderId: number, content: string) {
    try {
      const [room, participants, sender] = await Promise.all([
        this.chatRoomRepository.findOne({ where: { id: roomId } }),
        this.participantRepository.find({ where: { roomId } }),
        this.userRepo.findOne({ where: { id: senderId }, relations: { employee: true } }),
      ]);
      const senderName = sender?.employee?.full_name || 'Unknown';
      const groupName = room?.name || `Room #${roomId}`;

      const targetUserIds = participants.filter(p => p.userId !== senderId).map(p => p.userId);
      if (targetUserIds.length === 0) return;

      // Batch-load all target users
      const targetUsers = await this.userRepo.find({ where: { id: In(targetUserIds) } });
      const userMap = new Map(targetUsers.map((u: any) => [u.id, u]));

      await Promise.all(participants
        .filter(p => p.userId !== senderId)
        .map(async (p) => {
          const targetUser = userMap.get(p.userId);
          if (!targetUser) return;
          if (room?.isGroup && targetUser.email) {
            await this.notificationTriggers.chatMessageGroup(
              senderName, groupName, content, p.userId, targetUser.email,
            );
          } else if (!room?.isGroup) {
            await this.notificationTriggers.chatMessage(senderName, content, p.userId);
          }
        }));
    } catch (err) {
      this.logger.error(`[NOTIF-CHAT-ERR] ${(err as any).message}`);
    }
  }


  async sendMessage(
    projectId: string,
    userId: string,
    userName: string,
    content: string,
  ) {
    try {
      const userIdNum = parseInt(userId, 10) || 0;

      let room = await this.chatRoomRepository.findOne({
        where: { name: `Project ${projectId}` } as any,
      });

      if (!room) {
        const roomCreate = this.chatRoomRepository.create({
          name: `Project ${projectId}`,
        } as any);
        room = (await this.chatRoomRepository.save(roomCreate)) as unknown as ChatRoom;
      }

      const messageCreate = this.messageRepository.create({
        userId: userIdNum,
        roomId: room.id,
        content,
        type: 'TEXT',
      } as any);

      const saved = (await this.messageRepository.save(messageCreate)) as unknown as Message;

      this.realtimeService.emitChatMessage(projectId, {
        id: saved.id,
        channel: projectId,
        userId: userIdNum,
        userName,
        content: saved.content,
        createdAt: saved.createdAt,
      });

      this.logger.log(`[CHAT] Message sent by ${userName} in project ${projectId}`);
      return saved;
    } catch (error) {
      this.logger.error(`[CHAT] Send message failed: ${error}`);
      throw error;
    }
  }

  async getRoomMessages(projectId: string, limit = 50) {
    const room = await this.chatRoomRepository.findOne({
      where: { name: `Project ${projectId}` } as any,
    });
    if (!room) return [];

    return this.messageRepository.find({
      where: { roomId: room.id } as any,
      order: { createdAt: 'DESC' } as any,
      take: limit,
    });
  }


  async findOrCreateDM(userId1: number, userId2: number) {
    // Direct query: find rooms where both users are participants
    const roomIds1 = (await this.participantRepository.find({
      where: { userId: userId1 },
      select: ['roomId'] as any,
    })).map((p: any) => p.roomId);

    if (roomIds1.length > 0) {
      const roomIds2 = (await this.participantRepository.find({
        where: { userId: userId2, roomId: In(roomIds1) },
        select: ['roomId'] as any,
      })).map((p: any) => p.roomId);

      for (const roomId of roomIds2) {
        const count = await this.participantRepository.count({ where: { roomId } });
        if (count === 2) {
          const room = await this.chatRoomRepository.findOne({ where: { id: roomId, isGroup: false } });
          if (room) return room;
        }
      }
    }

    const room = this.chatRoomRepository.create({
      isGroup: false,
      createdBy: userId1,
    });
    const saved = await this.chatRoomRepository.save(room);

    await this.participantRepository.save([
      this.participantRepository.create({ roomId: saved.id, userId: userId1 }),
      this.participantRepository.create({ roomId: saved.id, userId: userId2 }),
    ]);

    this.logger.log(`[CHAT] DM room created: ${saved.id} (${userId1} ↔ ${userId2})`);
    return saved;
  }


  async createGroupRoom(name: string, createdBy: number, participantIds: number[], projectId?: number) {
    const room = this.chatRoomRepository.create({
      name,
      projectId,
      isGroup: true,
      createdBy,
    } as any);
    const saved = (await this.chatRoomRepository.save(room)) as unknown as ChatRoom;

    const allUserIds = [...new Set([createdBy, ...participantIds])].filter(uid => uid > 0);
    if (allUserIds.length > 0) {
      await this.participantRepository.save(
        allUserIds.map((uid) =>
          this.participantRepository.create({ roomId: (saved as any).id, userId: uid }),
        ),
      );
    }

    this.logger.log(`[CHAT] Group room created: ${(saved as any).id} — ${name}`);
    return saved;
  }


  async getUserRooms(userId: number) {
    const participations = await this.participantRepository.find({
      where: { userId },
    });
    if (participations.length === 0) return [];

    const roomIds = participations.map((p) => p.roomId);
    const [rooms, allParticipants, lastMessages] = await Promise.all([
      this.chatRoomRepository.find({
        where: { id: In(roomIds) },
        order: { createdAt: 'DESC' },
      }),
      this.participantRepository.find({ where: { roomId: In(roomIds) } }),
      // Get last message per room using raw query or subquery
      Promise.all(roomIds.map(roomId =>
        this.messageRepository.findOne({
          where: { roomId } as any,
          order: { createdAt: 'DESC' } as any,
        })
      )),
    ]);

    // Group participants by room
    const participantsByRoom = new Map<number, number[]>();
    for (const p of allParticipants) {
      if (!participantsByRoom.has(p.roomId)) participantsByRoom.set(p.roomId, []);
      participantsByRoom.get(p.roomId)!.push(p.userId);
    }

    // Map last messages
    const lastMsgByRoom = new Map<number, any>();
    for (const msg of lastMessages) {
      if (msg) lastMsgByRoom.set(msg.roomId, msg);
    }

    return rooms.map((room) => {
      const lastMsg = lastMsgByRoom.get(room.id);
      return {
        id: room.id,
        name: room.name,
        projectId: room.projectId,
        isGroup: room.isGroup,
        createdBy: room.createdBy,
        createdAt: room.createdAt,
        participantIds: participantsByRoom.get(room.id) ?? [],
        lastMessage: lastMsg
          ? { content: lastMsg.content, userId: lastMsg.userId, createdAt: lastMsg.createdAt }
          : null,
      };
    });
  }


  async sendRoomMessage(roomId: number, userId: number, userName: string, content: string) {
    const messageCreate = this.messageRepository.create({
      roomId,
      userId,
      content,
      type: 'TEXT',
    } as any);

    const saved = (await this.messageRepository.save(messageCreate)) as unknown as Message;

    this.realtimeService.emitRoomMessage(String(roomId), {
      id: saved.id,
      roomId,
      userId,
      userName,
      content: saved.content,
      createdAt: saved.createdAt,
    });

    this.fireChatNotif(roomId, userId, content).catch(() => undefined);

    this.logger.log(`[CHAT] Room message sent: ${userName} → room ${roomId}`);
    return saved;
  }


  async getRoomMessagesById(roomId: number, limit = 100) {
    const messages = await this.messageRepository.find({
        where: { roomId },
        relations: {
            user: {
      employee: true,
    },
        },
        order: {
            createdAt: "ASC",
        },
        take: limit,
    })

    return messages.map(message => ({
        id: message.id,
        roomId: message.roomId,
        userId: message.userId,
        userName: message.user?.employee?.full_name ?? "Unknown",
        content: message.content,
        createdAt: message.createdAt,
        type: message.type,
    }));
  }


  async getRoomByProject(projectId: number) {
    const room = await this.chatRoomRepository.findOne({
      where: { projectId } as any,
    });
    if (!room) throw new Error('Room not found');
    return room;
  }


  async isUserInRoom(roomId: number, userId: number): Promise<boolean> {
    const count = await this.participantRepository.count({
      where: { roomId, userId },
    });
    return count > 0;
  }

  async markMessageAsRead(messageId: number, userId: number) {
    const message = await this.messageRepository.findOne({ where: { id: messageId } });
    if (!message) throw new Error('Message not found');

    const readBy = message.readBy || [];
    if (!readBy.includes(userId)) {
      readBy.push(userId);
    }

    message.readBy = readBy;
    if (!message.readAt) {
      message.readAt = new Date();
    }

    const updated = await this.messageRepository.save(message);

    this.logger.log(`[CHAT] Message #${messageId} read by user #${userId}`);
    return { success: true, readBy: updated.readBy };
  }


  async addParticipant(roomId: number, userId: number) {
    const exists = await this.participantRepository.count({ where: { roomId, userId } });
    if (exists) return { alreadyMember: true };

    await this.participantRepository.save(
      this.participantRepository.create({ roomId, userId }),
    );
    this.logger.log(`[CHAT] User ${userId} added to room ${roomId}`);

    this.realtimeService.emitRoomMessage(String(roomId), {
      id: `sys-${Date.now()}`,
      roomId,
      userId: 0,
      userName: 'System',
      content: `User #${userId} joined the room`,
      createdAt: new Date().toISOString(),
    });

    return { success: true };
  }


  async removeParticipant(roomId: number, userId: number) {
    const result = await this.participantRepository.delete({ roomId, userId });
    this.logger.log(`[CHAT] User ${userId} removed from room ${roomId}`);

    this.realtimeService.emitRoomMessage(String(roomId), {
      id: `sys-${Date.now()}`,
      roomId,
      userId: 0,
      userName: 'System',
      content: `User #${userId} left the room`,
      createdAt: new Date().toISOString(),
    });

    return { affected: result.affected };
  }

  async findRoomMessagesWithCursor(
    roomId: number,
    query: CursorQueryDto,
  ): Promise<PaginatedResponseDto<MessageDto>> {
    const limit = Math.min(query.limit || 30, 100);
    const cursor = query.cursor ? this.cursorService.decode(query.cursor) : null;

    const qb = this.messageRepository
      .createQueryBuilder('message')
      .leftJoinAndSelect('message.user', 'user')
      .leftJoinAndSelect('user.employee', 'employee')
      .where('message.roomId = :roomId', { roomId })
      .orderBy('message.createdAt', 'DESC')
      .addOrderBy('message.id', 'DESC')
      .limit(limit + 1);

    if (cursor) {
      qb.andWhere('(message.createdAt, message.id) < (:createdAt, :id)', {
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

    const dtos = items.map((msg) => ({
      id: msg.id,
      content: msg.content,
      createdAt: msg.createdAt.toISOString(),
      updatedAt: msg.createdAt.toISOString(), // Assuming no updates
      roomId: msg.roomId,
      sender: {
        id: msg.user.id,
        name: msg.user.employee?.full_name || `User ${msg.user.id}`,
        avatar_url: msg.user.employee?.avatar_url,
      },
    }));

    return {
      items: dtos,
      nextCursor,
      hasMore,
    };
  }

  async deleteRoomByProjectId(projectId: number): Promise<void> {
    const room = await this.chatRoomRepository.findOneBy({ projectId });
    if (room) {
      await this.participantRepository.delete({ roomId: room.id });
      await this.messageRepository.delete({ roomId: room.id });
      await this.chatRoomRepository.remove(room);
    }
  }
}


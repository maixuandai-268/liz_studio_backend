import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Message } from './entities/message.entity';
import { ChatRoom } from './entities/chat-room.entity';
import { ChatParticipant } from './entities/chat-participant.entity';
import { RealtimeService } from '@/modules/realtime/realtime.service';

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
  ) {}

  // ─── Channel-based (cũ) ───

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

  // ─── DM: find or create 1:1 room ───

  async findOrCreateDM(userId1: number, userId2: number) {
    // Tìm tất cả DM rooms
    const rooms = await this.chatRoomRepository
      .createQueryBuilder('room')
      .innerJoin('room.participants', 'p')
      .where('room.is_group = false')
      .groupBy('room.id')
      .getMany();

    for (const room of rooms) {
      const participants = await this.participantRepository.find({
        where: { roomId: room.id },
      });
      if (participants.length !== 2) continue;
      const uids = participants.map((p) => p.userId).sort((a, b) => a - b);
      const query = [userId1, userId2].sort((a, b) => a - b);
      if (uids[0] === query[0] && uids[1] === query[1]) {
        return room;
      }
    }

    // Chưa có → tạo mới
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

  // ─── Group: create room ───

  async createGroupRoom(name: string, createdBy: number, participantIds: number[]) {
    const room = this.chatRoomRepository.create({
      name,
      isGroup: true,
      createdBy,
    });
    const saved = await this.chatRoomRepository.save(room);

    const allUserIds = [...new Set([createdBy, ...participantIds])];
    await this.participantRepository.save(
      allUserIds.map((uid) =>
        this.participantRepository.create({ roomId: saved.id, userId: uid }),
      ),
    );

    this.logger.log(`[CHAT] Group room created: ${saved.id} — ${name}`);
    return saved;
  }

  // ─── List rooms của user ───

  async getUserRooms(userId: number) {
    const participations = await this.participantRepository.find({
      where: { userId },
    });
    if (participations.length === 0) return [];

    const roomIds = participations.map((p) => p.roomId);
    const rooms = await this.chatRoomRepository.find({
      where: { id: In(roomIds) },
      order: { createdAt: 'DESC' },
    });

    const enriched = await Promise.all(
      rooms.map(async (room) => {
        const participants = await this.participantRepository.find({
          where: { roomId: room.id },
        });
        const lastMessage = await this.messageRepository.findOne({
          where: { roomId: room.id } as any,
          order: { createdAt: 'DESC' } as any,
        });
        return {
          id: room.id,
          name: room.name,
          isGroup: room.isGroup,
          createdBy: room.createdBy,
          createdAt: room.createdAt,
          participantIds: participants.map((p) => p.userId),
          lastMessage: lastMessage
            ? { content: lastMessage.content, userId: lastMessage.userId, createdAt: lastMessage.createdAt }
            : null,
        };
      }),
    );

    return enriched;
  }

  // ─── Gửi tin vào room theo roomId ───

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

    this.logger.log(`[CHAT] Room message sent: ${userName} → room ${roomId}`);
    return saved;
  }

  // ─── Lấy history của room ───

  async getRoomMessagesById(roomId: number) {
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
    })
    console.log(messages);

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

  // ─── Kiểm tra user có trong room ───

  async isUserInRoom(roomId: number, userId: number): Promise<boolean> {
    const count = await this.participantRepository.count({
      where: { roomId, userId },
    });
    return count > 0;
  }
}

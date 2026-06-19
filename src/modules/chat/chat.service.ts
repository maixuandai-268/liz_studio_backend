import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Message } from './entities/message.entity';
import { ChatRoom } from './entities/chat-room.entity';
import { RealtimeService } from '@/modules/realtime/realtime.service';

@Injectable()
export class ChatService {
  private logger = new Logger('ChatService');

  constructor(
    @InjectRepository(Message)
    private messageRepository: Repository<Message>,
    @InjectRepository(ChatRoom)
    private chatRoomRepository: Repository<ChatRoom>,
    private realtimeService: RealtimeService,
  ) {}

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
        roomId: room.id,
        userId: userIdNum,
        content,
        type: 'TEXT',
      } as any);

      const saved = (await this.messageRepository.save(messageCreate)) as unknown as Message;

      this.realtimeService.emitChatMessage(projectId, {
        id: saved.id,
        userId: userIdNum,
        userName,
        content: saved.content,
        createdAt: saved.createdAt,
      });

      this.logger.log(
        `[CHAT] Message sent by ${userName} in project ${projectId}`,
      );
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
}

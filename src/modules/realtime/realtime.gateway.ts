import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { RealtimeService } from './realtime.service';
import { ChatService } from '@/modules/chat/chat.service';
import { parse } from 'cookie';

@WebSocketGateway({
  cors: {
    origin: process.env.WS_ORIGIN || 'http://localhost:3000',
    credentials: true,
  },
  transports: ['websocket', 'polling'],
})
export class RealtimeGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private logger = new Logger('RealtimeGateway');
  private clientToUser = new Map<string, { userId: string; role: string; name: string }>();

  constructor(
    private readonly realtimeService: RealtimeService,
    private readonly chatService: ChatService,
    private readonly jwtService: JwtService,
  ) {
    if (!realtimeService) {
      throw new Error('RealtimeService not injected');
    }
  }

  afterInit() {
    this.realtimeService.setServer(this.server);
    this.logger.log('RealtimeGateway initialized');
  }

  private verifyToken(token?: string | string[] | null): any {
    try {
      if (!token) return null;
      const tokenStr = Array.isArray(token) ? token[0] : token;
      return this.jwtService.verify(tokenStr, {
        secret: process.env.JWT_SECRET,
      });
    } catch (error) {
      this.logger.warn(`[WS_AUTH] Token verification failed: ${error}`);
      return null;
    }
  }

  private getTokenFromCookie(cookieHeader?: string) {
  if (!cookieHeader) return null;

  return parse(cookieHeader).auth_token ?? null;
}

  handleConnection(client: Socket) {
    const token =
      this.getTokenFromCookie(client.handshake.headers.cookie) ||
      (client.handshake.auth?.token as string | undefined) ||
      (client.handshake.query.token as string | undefined) ||
      (client.handshake.headers.authorization as string | undefined)?.split(' ')[1];

    const user = this.verifyToken(token);

    if (!user) {
      this.logger.warn(`[CONNECTION] Rejected (invalid token): ${client.id}`);
      client.disconnect();
      return;
    }

    this.clientToUser.set(client.id, {
      userId: user.sub || user.userId,
      role: user.role || 'employee',
      name: user.code || String(user.sub || user.userId),
    });

    this.logger.log(`[CONNECTION] User ${user.sub} (${user.role}) connected`);
    client.join(`user-${user.sub}`);
    this.broadcastOnlineUsers();
  }

  handleDisconnect(@ConnectedSocket() client: Socket) {
    const user = this.clientToUser.get(client.id);
    if (user) {
      this.logger.log(`[DISCONNECT] User ${user.userId} disconnected: ${client.id}`);
      this.clientToUser.delete(client.id);
      this.broadcastOnlineUsers();
    }
  }

  private broadcastOnlineUsers() {
    const users = Array.from(this.clientToUser.values()).map((user) => ({
      userId: user.userId,
      name: user.name,
      role: user.role,
    }));
    this.server.emit('users_online', users);
  }

  // ─── Channel chat (cũ) ───

  @SubscribeMessage('room:join')
  async handleRoomJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { projectId: string },
  ) {
    const user = this.clientToUser.get(client.id);
    if (!user) {
      this.logger.warn(`[ROOM:JOIN] Unknown user: ${client.id}`);
      return { error: 'Unauthorized' };
    }

    const { projectId } = payload;
    const room = `project-${projectId}`;
    client.join(room);
    this.logger.log(`[ROOM:JOIN] User ${user.userId} joined room ${room}`);

    try {
      const messages = await this.chatService.getRoomMessages(projectId, 50);
      const messagesWithChannel = messages.map((m) => ({
        ...m,
        channel: projectId,
      }));
      client.emit('messages:init', messagesWithChannel);
      this.logger.log(`[ROOM:JOIN] Sent ${messages.length} messages to ${user.userId}`);
    } catch (error) {
      this.logger.error(`[ROOM:JOIN] Failed to fetch messages: ${error}`);
    }

    this.realtimeService.broadcastUserOnline(projectId, user.userId, {
      id: user.userId,
      role: user.role,
    });

    return { success: true, room, projectId };
  }

  @SubscribeMessage('room:leave')
  handleRoomLeave(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { projectId: string },
  ) {
    const user = this.clientToUser.get(client.id);
    if (!user) return { error: 'Unauthorized' };

    const { projectId } = payload;
    const room = `project-${projectId}`;
    client.leave(room);
    this.realtimeService.broadcastUserOffline(projectId, user.userId);
    return { success: true, room };
  }

  @SubscribeMessage('chat:send')
  async handleChatSend(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { projectId: string; message: string },
  ) {
    const user = this.clientToUser.get(client.id);
    if (!user) return { error: 'Unauthorized' };
    const { projectId, message } = payload;

    const savedMessage = await this.chatService.sendMessage(
      projectId,
      user.userId,
      user.name,
      message.trim(),
    );

    this.server.to(`project-${projectId}`).emit('chat:message', {
      ...savedMessage,
      channel: projectId,
    });
    return { success: true };
  }

  // ─── Room chat (mới) ───

  @SubscribeMessage('room:join_chat')
  async handleRoomJoinChat(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { roomId: number },
  ) {
    const user = this.clientToUser.get(client.id);
    if (!user) return { error: 'Unauthorized' };

    const { roomId } = payload;
    const room = `chat-room-${roomId}`;
    client.join(room);
    this.logger.log(`[ROOM:JOIN_CHAT] User ${user.userId} joined chat-room-${roomId}`);

    try {
      const messages = await this.chatService.getRoomMessagesById(roomId);
      client.emit('room:messages_init', messages);
    } catch (error) {
      this.logger.error(`[ROOM:JOIN_CHAT] Failed: ${error}`);
    }

    return { success: true, room };
  }

  @SubscribeMessage('room:leave_chat')
  handleRoomLeaveChat(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { roomId: number },
  ) {
    const user = this.clientToUser.get(client.id);
    if (!user) return { error: 'Unauthorized' };

    const room = `chat-room-${payload.roomId}`;
    client.leave(room);
    return { success: true };
  }

  @SubscribeMessage('room:send')
  async handleRoomSend(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { roomId: number; content: string },
  ) {
    const user = this.clientToUser.get(client.id);
    if (!user) return { error: 'Unauthorized' };

    const { roomId, content } = payload;
    if (!roomId || !content?.trim()) return { error: 'Invalid payload' };

    try {
      const saved = await this.chatService.sendRoomMessage(
        roomId,
        Number(user.userId),
        user.name,
        content.trim(),
      );
      return { success: true, message: saved };
    } catch (error) {
      this.logger.error(`[ROOM:SEND] Failed: ${error}`);
      return { error };
    }
  }

  // ─── Typing ───

  @SubscribeMessage('typing:start')
  handleTypingStart(
    @ConnectedSocket() client: Socket,
    @MessageBody() channel: string,
  ) {
    const user = this.clientToUser.get(client.id);
    if (!user || !channel) return;
    client.broadcast.emit('typing:update', {
      userId: user.userId,
      name: user.name,
      channel,
      typing: true,
    });
  }

  @SubscribeMessage('typing:stop')
  handleTypingStop(
    @ConnectedSocket() client: Socket,
    @MessageBody() channel: string,
  ) {
    const user = this.clientToUser.get(client.id);
    if (!user || !channel) return;
    client.broadcast.emit('typing:update', {
      userId: user.userId,
      name: user.name,
      channel,
      typing: false,
    });
  }
}

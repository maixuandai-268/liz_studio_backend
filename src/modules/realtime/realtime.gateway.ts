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

  ngAfterInit() {
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

    const cookies = Object.fromEntries(
      cookieHeader.split('; ').map((cookie) => {
        const [key, ...value] = cookie.split('=');
        return [key, decodeURIComponent(value.join('='))];
      }),
    );

    return cookies.auth_token || cookies.refresh_token;
  }

  handleConnection(client: Socket) {
  const token =
    this.getTokenFromCookie(client.handshake.headers.cookie) ||
    (client.handshake.auth?.token as string | undefined) ||
    (client.handshake.query.token as string | undefined) ||
    (client.handshake.headers.authorization as string | undefined)?.split(' ')[1];

  const user = this.verifyToken(token);

  if (!user) {
    this.logger.warn(
      `[CONNECTION] Rejected (invalid token): ${client.id}`,
    );

    client.disconnect();
    return;
  }

  this.clientToUser.set(client.id, {
    userId: user.sub || user.userId,
    role: user.role || 'employee',
    name: user.code || String(user.sub || user.userId),
  });

  this.logger.log(
    `[CONNECTION] User ${user.sub} (${user.role}) connected`,
  );

  client.join(`user-${user.sub}`);
  this.broadcastOnlineUsers();
}

  handleDisconnect(@ConnectedSocket() client: Socket) {
    const user = this.clientToUser.get(client.id);

    if (user) {
      this.logger.log(
        `[DISCONNECT] User ${user.userId} disconnected: ${client.id}`,
      );
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

  @SubscribeMessage('room:join')
  handleRoomJoin(
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
    this.logger.log(
      `[ROOM:JOIN] User ${user.userId} joined room ${room}`,
    );

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
    if (!user) {
      this.logger.warn(`[ROOM:LEAVE] Unknown user: ${client.id}`);
      return { error: 'Unauthorized' };
    }

    const { projectId } = payload;
    const room = `project-${projectId}`;

    client.leave(room);
    this.logger.log(`[ROOM:LEAVE] User ${user.userId} left room ${room}`);

    this.realtimeService.broadcastUserOffline(projectId, user.userId);

    return { success: true, room };
  }

  @SubscribeMessage('ping')
  handlePing() {
    return { pong: true };
  }

  @SubscribeMessage('chat:send')
  async handleChatSend(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { projectId: string; message: string },
  ) {
    const user = this.clientToUser.get(client.id);
    if (!user) {
      this.logger.warn(`[CHAT:SEND] Unknown user: ${client.id}`);
      return { error: 'Unauthorized' };
    }

    const { projectId, message } = payload;

    if (!projectId || !message?.trim()) {
      return { error: 'Invalid payload' };
    }

    try {
      await this.chatService.sendMessage(
        projectId,
        user.userId,
        user.userId,
        message.trim(),
      );

      return { success: true };
    } catch (error) {
      this.logger.error(`[CHAT:SEND] Failed: ${error}`);
      return { error: error };
    }
  }

  @SubscribeMessage('message:send')
  handleMessageSend(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { channel: string; content: string; type?: 'text' | 'system' | 'file' },
  ) {
    const user = this.clientToUser.get(client.id);
    if (!user) {
      this.logger.warn(`[MESSAGE:SEND] Unknown user: ${client.id}`);
      return { error: 'Unauthorized' };
    }

    const content = payload.content?.trim();
    if (!payload.channel || !content) {
      return { error: 'Invalid payload' };
    }

    const message = {
      id: `${Date.now()}-${client.id}`,
      channel: payload.channel,
      senderId: user.userId,
      senderName: user.name,
      senderRole: user.role,
      content,
      timestamp: Date.now(),
      type: payload.type || 'text',
    };

    this.server.emit('message:new', message);
    return { success: true, message };
  }

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

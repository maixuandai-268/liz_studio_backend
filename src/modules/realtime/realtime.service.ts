import { Injectable, Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';

@Injectable()
export class RealtimeService {
  private logger = new Logger('RealtimeService');
  private server: Server;

  setServer(server: Server) {
    this.server = server;
  }

  // ── Task events ──

  emitTaskEvent(
    projectId: string,
    eventType: 'created' | 'updated' | 'deleted' | 'moved',
    payload: any,
  ) {
    if (!this.server) return;
    const room = `project-${projectId}`;
    this.server.to(room).emit(`task.${eventType}`, payload);
    this.logger.log(`[TASK] ${eventType.toUpperCase()} emitted to room ${room}`);
  }

  // ── Timeline ──

  emitTimelineEvent(projectId: string, payload: any) {
    if (!this.server) return;
    const room = `project-${projectId}`;
    this.server.to(room).emit('timeline.created', payload);
    this.logger.log(`[TIMELINE] CREATED emitted to room ${room}`);
  }

  // ── Channel chat (cũ) ──

  emitChatMessage(projectId: string, payload: any) {
    if (!this.server) return;
    const room = `project-${projectId}`;
    this.server.to(room).emit('chat.message', payload);
    this.logger.log(`[CHAT] MESSAGE emitted to room ${room}`);
  }

  // ── Room chat (mới) ──

  emitRoomMessage(roomId: string, payload: any) {
    if (!this.server) return;
    const room = `chat-room-${roomId}`;
    this.server.to(room).emit('room.message', payload);
    this.logger.log(`[CHAT] ROOM_MESSAGE emitted to room ${room}`);
  }

  // ── Notifications ──

  emitNotification(userId: string, payload: any) {
    if (!this.server) return;
    const room = `user-${userId}`;
    this.server.to(room).emit('notification.created', payload);
    this.logger.log(`[NOTIFICATION] CREATED emitted to room ${room}`);
  }

  // ── Online/offline ──

  broadcastUserOnline(projectId: string, userId: string, user: any) {
    if (!this.server) return;
    const room = `project-${projectId}`;
    this.server.to(room).emit('user.online', { userId, user });
    this.logger.log(`[USER] ONLINE: ${userId} in room ${room}`);
  }

  broadcastUserOffline(projectId: string, userId: string) {
    if (!this.server) return;
    const room = `project-${projectId}`;
    this.server.to(room).emit('user.offline', { userId });
    this.logger.log(`[USER] OFFLINE: ${userId} in room ${room}`);
  }

  // ── Utils ──

  getRoomClients(room: string) {
    if (!this.server) return [];
    return Array.from(this.server.sockets.adapter.rooms.get(room) || []);
  }

  broadcastAll(event: string, payload: any) {
    if (!this.server) return;
    this.server.emit(event, payload);
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';

/**
 * RealtimeService
 *
 * Centralized service để handle realtime operations.
 * Không xử lý business logic — chỉ broadcast events.
 *
 * Dependency: Được inject bởi các module (Tasks, Chat, Notifications)
 * để emit events thông qua RealtimeGateway.
 */
@Injectable()
export class RealtimeService {
  private logger = new Logger('RealtimeService');
  private server: Server;

  /**
   * Set server instance từ Gateway
   */
  setServer(server: Server) {
    this.server = server;
  }

  /**
   * Emit task event đến tất cả user trong project room
   * Events: task.created, task.updated, task.deleted, task.moved
   */
  emitTaskEvent(
    projectId: string,
    eventType: 'created' | 'updated' | 'deleted' | 'moved',
    payload: any,
  ) {
    if (!this.server) return;
    const room = `project-${projectId}`;
    this.server.to(room).emit(`task.${eventType}`, payload);
    this.logger.log(
      `[TASK] ${eventType.toUpperCase()} emitted to room ${room}`,
    );
  }

  /**
   * Emit timeline event
   * Event: timeline.created
   */
  emitTimelineEvent(projectId: string, payload: any) {
    if (!this.server) return;
    const room = `project-${projectId}`;
    this.server.to(room).emit('timeline.created', payload);
    this.logger.log(`[TIMELINE] CREATED emitted to room ${room}`);
  }

  /**
   * Emit chat message
   * Event: chat.message
   */
  emitChatMessage(projectId: string, payload: any) {
    if (!this.server) return;
    const room = `project-${projectId}`;
    this.server.to(room).emit('chat.message', payload);
    this.logger.log(`[CHAT] MESSAGE emitted to room ${room}`);
  }

  /**
   * Emit notification
   * Event: notification.created
   */
  emitNotification(userId: string, payload: any) {
    if (!this.server) return;
    const room = `user-${userId}`;
    this.server.to(room).emit('notification.created', payload);
    this.logger.log(`[NOTIFICATION] CREATED emitted to room ${room}`);
  }

  /**
   * Broadcast user online
   * Event: user.online
   */
  broadcastUserOnline(projectId: string, userId: string, user: any) {
    if (!this.server) return;
    const room = `project-${projectId}`;
    this.server.to(room).emit('user.online', { userId, user });
    this.logger.log(`[USER] ONLINE: ${userId} in room ${room}`);
  }

  /**
   * Broadcast user offline
   * Event: user.offline
   */
  broadcastUserOffline(projectId: string, userId: string) {
    if (!this.server) return;
    const room = `project-${projectId}`;
    this.server.to(room).emit('user.offline', { userId });
    this.logger.log(`[USER] OFFLINE: ${userId} in room ${room}`);
  }

  /**
   * Get connected sockets in room
   */
  getRoomClients(room: string) {
    if (!this.server) return [];
    return Array.from(this.server.sockets.adapter.rooms.get(room) || []);
  }

  /**
   * Broadcast to all connected
   */
  broadcastAll(event: string, payload: any) {
    if (!this.server) return;
    this.server.emit(event, payload);
  }
}

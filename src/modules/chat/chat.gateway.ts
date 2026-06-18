import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  namespace: '/chat',
  cors: {
    origin: '*', // production nên set cụ thể domain
  },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  handleConnection(@ConnectedSocket() client: Socket) {
    client.emit('chat:connected', { socketId: client.id });
  }

  handleDisconnect(@ConnectedSocket() client: Socket) {
    // tùy bạn: log hoặc dọn dữ liệu room ở DB
    console.log('disconnect:', client.id);
  }

  // Client yêu cầu join room
  @SubscribeMessage('room:join')
  onRoomJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { roomId: string; username?: string },
  ) {
    const { roomId, username } = payload;

    client.join(roomId);

    // thông báo cho cả room
    this.server.to(roomId).emit('room:joined', {
      roomId,
      message: `${username ?? 'Someone'} joined`,
      userId: client.id,
    });

    // phản hồi riêng cho người vừa join
    client.emit('room:join-ack', { roomId });
  }

  // Client gửi tin nhắn vào room
  @SubscribeMessage('chat:send')
  onChatSend(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { roomId: string; message: string },
  ) {
    const { roomId, message } = payload;

    const chatMessage = {
      roomId,
      message,
      senderId: client.id,
      sentAt: new Date().toISOString(),
    };

    // broadcast tới tất cả trong room (kể cả sender nếu bạn muốn)
    this.server.to(roomId).emit('chat:message', chatMessage);
  }

  // (tuỳ chọn) rời room
  @SubscribeMessage('room:leave')
  onRoomLeave(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { roomId: string; username?: string },
  ) {
    const { roomId, username } = payload;

    client.leave(roomId);

    this.server.to(roomId).emit('room:left', {
      roomId,
      message: `${username ?? 'Someone'} left`,
      userId: client.id,
    });

    client.emit('room:leave-ack', { roomId });
  }
}
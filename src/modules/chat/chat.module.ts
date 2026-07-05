import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChatRoom } from './entities/chat-room.entity';
import { ChatParticipant } from './entities/chat-participant.entity';
import { Message } from './entities/message.entity';
import { ChatService } from './chat.service';
import { ChatController } from './chat.controller';
import { RealtimeModule } from '@/modules/realtime/realtime.module';
import { NotificationsModule } from '@/modules/notifications/notifications.module';
import { Channel } from './entities/channel.entity';
import { ChannelService } from './channels/channel.service';
import { User } from '@/modules/users/entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([ChatRoom, ChatParticipant, Message, Channel, User]),
    forwardRef(() => RealtimeModule),
    NotificationsModule,
  ],
  controllers: [ChatController],
  providers: [ChatService, ChannelService],
  exports: [ChatService, ChannelService],
})
export class ChatModule {}


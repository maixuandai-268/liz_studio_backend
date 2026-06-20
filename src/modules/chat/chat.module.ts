import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChatRoom } from './entities/chat-room.entity';
import { ChatParticipant } from './entities/chat-participant.entity';
import { Message } from './entities/message.entity';
import { ChatService } from './chat.service';
import { ChatController } from './chat.controller';
import { RealtimeModule } from '@/modules/realtime/realtime.module';
import { Channel } from './entities/channel.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([ChatRoom, ChatParticipant, Message , Channel]),
    forwardRef(() => RealtimeModule),
  ],
  controllers: [ChatController],
  providers: [ChatService],
  exports: [ChatService],
})
export class ChatModule {}

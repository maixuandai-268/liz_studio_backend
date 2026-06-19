import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChatRoom } from './entities/chat-room.entity';
import { ChatParticipant } from './entities/chat-participant.entity';
import { Message } from './entities/message.entity';
import { ChatService } from './chat.service';
import { RealtimeModule } from '@/modules/realtime/realtime.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ChatRoom, ChatParticipant, Message]),
    forwardRef(() => RealtimeModule),
  ],
  providers: [ChatService],
  exports: [ChatService],
})
export class ChatModule {}

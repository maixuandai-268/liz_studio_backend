import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ChatRoom } from './chat-room.entity';
import { User } from '../../users/entities/user.entity';

@Entity('chat_participants')
export class ChatParticipant {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'room_id' })
  roomId: number;

  @Column({ name: 'user_id' })
  userId: number;

  @CreateDateColumn({ name: 'joined_at' })
  joinedAt: Date;

  @ManyToOne(() => ChatRoom, (r) => r.participants)
  @JoinColumn({ name: 'room_id' })
  room: ChatRoom;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;
}


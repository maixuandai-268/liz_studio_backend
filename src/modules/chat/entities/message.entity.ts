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

@Entity('messages')
export class Message {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'room_id' })
  roomId: number;

  @Column({ name: 'user_id' })
  userId: number;

  @Column({ length: 50, default: 'TEXT' })
  type: string;

  @Column({ type: 'text', nullable: true })
  content: string;

  @Column({ name: 'attachment_url', length: 255, nullable: true })
  attachmentUrl: string;

  @Column({ name: 'is_read', default: false })
  isRead: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => ChatRoom, (r) => r.messages)
  @JoinColumn({ name: 'room_id' })
  room: ChatRoom;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;
}

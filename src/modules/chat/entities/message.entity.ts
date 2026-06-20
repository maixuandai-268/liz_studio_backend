import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ChatRoom } from './chat-room.entity';
import { Channel } from './channel.entity';
import { User } from '../../users/entities/user.entity';

@Entity('messages')
export class Message {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'channel_id', nullable: true })
  channelId: number;

  @Column({ name: 'room_id', nullable: true })
  roomId: number;

  @Column({ name: 'user_id' })
  userId: number;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'varchar', length: 50, default: 'TEXT' })
  type: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => Channel, (channel) => channel.messages)
  @JoinColumn({ name: 'channel_id' })
  channel: Channel;

  @ManyToOne(() => ChatRoom, (room) => room.messages)
  @JoinColumn({ name: 'room_id' })
  room: ChatRoom;

  @ManyToOne(() => User)
  @JoinColumn({ name: "user_id" })
  user: User;
}
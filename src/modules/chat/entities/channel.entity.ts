import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Message } from './message.entity';

@Entity('channels')
export class Channel {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  name: string;

  @Column({ nullable: true, type: 'text' })
  description: string;

  @Column({ default: true })
  isPublic: boolean;

  @Column({
    type: 'varchar',
    default: 'all',
    comment: "Restrict to: 'all', 'admin'",
  })
  restrictTo: string;

  @Column({ nullable: true })
  icon: string;

  @Column({ default: 0 })
  messageCount: number;

  @OneToMany(() => Message, (msg) => msg.channel)
  messages: Message[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}


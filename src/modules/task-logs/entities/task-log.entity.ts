import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('task_logs')
export class TaskLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  taskId: number;

  @Column()
  projectId: string;

  @Column()
  action: 'created' | 'updated' | 'moved' | 'commented' | 'assigned' | 'deleted';

  @Column('jsonb', { nullable: true })
  changes?: {
    field: string;
    oldValue: any;
    newValue: any;
  }[];

  @Column({ nullable: true })
  userId?: string;

  @Column({ nullable: true })
  userName?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}


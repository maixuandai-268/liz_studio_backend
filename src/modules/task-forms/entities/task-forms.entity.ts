import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { TaskFormField } from './task-form-field.entity';
import { TaskFormSubmission } from './task-form-submission.entity';

@Entity('task_forms')
export class TaskForm {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ name: 'created_by', nullable: true })
  createdBy: number;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => TaskFormField, (f) => f.form)
  fields: TaskFormField[];

  @OneToMany(() => TaskFormSubmission, (s) => s.form)
  submissions: TaskFormSubmission[];
}


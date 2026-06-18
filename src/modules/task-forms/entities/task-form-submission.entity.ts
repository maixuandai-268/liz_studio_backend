import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { TaskForm } from './task-forms.entity';
import { Task } from '../../tasks/entities/task.entity';
import { User } from '../../users/entities/user.entity';
import { TaskFormSubmissionValue } from './task-form-submission-value.entity';

@Entity('task_form_submissions')
export class TaskFormSubmission {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'form_id' })
  formId: number;

  @Column({ name: 'task_id' })
  taskId: number;

  @Column({ name: 'submitted_by' })
  submittedBy: number;

  @CreateDateColumn({ name: 'submitted_at' })
  submittedAt: Date;

  @ManyToOne(() => TaskForm, (f) => f.submissions)
  @JoinColumn({ name: 'form_id' })
  form: TaskForm;

  @ManyToOne(() => Task)
  @JoinColumn({ name: 'task_id' })
  task: Task;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'submitted_by' })
  submitter: User;

  @OneToMany(() => TaskFormSubmissionValue, (v) => v.submission)
  values: TaskFormSubmissionValue[];
}

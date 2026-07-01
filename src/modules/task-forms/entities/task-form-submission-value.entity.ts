import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { TaskFormSubmission } from './task-form-submission.entity';
import { TaskFormField } from './task-form-field.entity';

@Entity('task_form_submission_values')
export class TaskFormSubmissionValue {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'submission_id' })
  submissionId: number;

  @Column({ name: 'field_id' })
  fieldId: number;

  @Column({ type: 'text', nullable: true })
  value: string;

  @ManyToOne(() => TaskFormSubmission, (s) => s.values)
  @JoinColumn({ name: 'submission_id' })
  submission: TaskFormSubmission;

  @ManyToOne(() => TaskFormField, (f) => f.values)
  @JoinColumn({ name: 'field_id' })
  field: TaskFormField;
}


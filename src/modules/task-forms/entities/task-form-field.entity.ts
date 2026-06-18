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
import { TaskFormSubmissionValue } from './task-form-submission-value.entity';

@Entity('task_form_fields')
export class TaskFormField {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'form_id' })
  formId: number;

  @Column({ length: 255 })
  label: string;

  @Column({ name: 'field_key', length: 100 })
  fieldKey: string;

  @Column({ name: 'field_type', length: 50 })
  fieldType: string;

  @Column({ length: 255, nullable: true })
  placeholder: string;

  @Column({ name: 'default_value', type: 'text', nullable: true })
  defaultValue: string;

  @Column({ type: 'text', nullable: true })
  options: string;

  @Column({ name: 'is_required', default: false })
  isRequired: boolean;

  @Column({ name: 'display_order', default: 0 })
  displayOrder: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => TaskForm, (f) => f.fields)
  @JoinColumn({ name: 'form_id' })
  form: TaskForm;

  @OneToMany(() => TaskFormSubmissionValue, (v) => v.field)
  values: TaskFormSubmissionValue[];
}

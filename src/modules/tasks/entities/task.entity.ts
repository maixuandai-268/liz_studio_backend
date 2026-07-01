/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable prettier/prettier */
import { Projects } from '@/modules/projects/entities/project.entity';
import { Task_Categories } from '@/modules/tasks/entities/categories.entity';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  OneToMany,
  JoinColumn,
  ManyToOne,
} from 'typeorm';
import { TaskAssignee } from './task-assignee.entity';

@Entity('tasks')
export class Task {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  project_id: number;

  @Column({ nullable: true })
  task_code: number;

  @Column({ nullable: true })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ nullable: true })
  status: string;

  @Column({ nullable: true })
  priority: string;

  @Column({ nullable: true })
  estimated_time: number;

  @Column({ nullable: true })
  actual_time: number;

  @Column({ nullable: true })
  story_points: number;

  @Column({ nullable: true })
  start_date: Date;

  @Column({ nullable: true })
  due_date: Date;

  @Column({ nullable: true })
  completed_at: Date; 

  @Column({ nullable: true })
  kpi_points: number;

  @Column({ default: false })
  pending_approval: boolean;

  @Column({ nullable: true })
  previous_phase: string;

  @Column({ nullable: true, default: false })
  revision_requested: boolean;

  @Column({ type: 'text', nullable: true })
  revision_reason: string;

  @Column( 'text' ,{ nullable: true , array :true })
  imagesIllustration: string[];

  @Column('text' ,{ nullable: true , array :true })
  imagesURL: string[];

  @Column({ nullable: true })
  created_by: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => Projects,(projects) => projects.task,
    { onDelete: 'CASCADE',},
  )
  @JoinColumn({ name: 'project_id', })
  project: Projects;

  @OneToMany(() => TaskAssignee, (assignee) => assignee.task)
  task_assignees: TaskAssignee[];

  @Column()
  category_id: number;
  @ManyToOne(() => Task_Categories,(category) => category.task,
  )
  @JoinColumn({
    name: 'category_id',
  })
  category: Task_Categories;

}


/* eslint-disable prettier/prettier */
import { Task } from '@/modules/tasks/entities/task.entity';
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, OneToMany } from 'typeorm';

@Entity('projects')
export class Projects {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  projectName: string;

  @Column({ nullable: true })
  year: number;

  @Column('text')
  backgroundImage: string;

  @Column({ type: 'text', nullable: true })
  clientName: string;

  @Column({ type: 'text', nullable: true })
  locationName: string;

  @Column({default : "active"})
  status: 'active' | 'review' | 'completed' | 'canceled';

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ nullable: true })
  start_date : Date;

  @Column({ nullable: true })
  due_date : Date;


  @CreateDateColumn()
  createdAt: Date;

  @OneToMany(() => Task, (task) => task.project)
  task: Task[];
}
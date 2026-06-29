/* eslint-disable prettier/prettier */
import { Task } from '@/modules/tasks/entities/task.entity';
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';

@Entity('task_categories')
export class Task_Categories {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({nullable: true})
  tittle: string;

  @Column({nullable: true})
  categoryColor: string;


  @OneToMany(() => Task, (task) => task.category)
  task: Task[];
}
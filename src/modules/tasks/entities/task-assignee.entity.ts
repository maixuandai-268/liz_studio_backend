import { 
  Entity, 
  PrimaryGeneratedColumn, 
  Column, 
  CreateDateColumn, 
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Task } from './task.entity';

@Entity('task_assignee')
export class TaskAssignee {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({nullable : true})   
  taskId : number;

  @ManyToOne(() => Task, (task) => task.task_assignees)
  @JoinColumn({ name: 'taskId' })
  task: Task;

  @Column({nullable :true})   
  userId : number;

  @Column({ default: false })
  is_main: boolean;

  @CreateDateColumn()
  assignedAt: Date;
}


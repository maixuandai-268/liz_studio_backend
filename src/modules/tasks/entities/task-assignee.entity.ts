import { 
  Entity, 
  PrimaryGeneratedColumn, 
  Column, 
  CreateDateColumn, 
} from 'typeorm';

@Entity('task_assignee')
export class TaskAssignee {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({nullable : true})   
  taskId : number;

  @Column({nullable :true})   
  userId : number;

  @Column({ default: false })
  is_main: boolean;

  @CreateDateColumn()
  assignedAt: Date;
}
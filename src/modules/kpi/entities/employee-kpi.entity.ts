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

  @Column({nullable : true})
  product_type_id: number;

  @Column({default : "phase 1"})
  phase: string;

  @Column({nullable : true})
  points : number;

  @Column({nullable : true})
  achieved_date:Date;

  @CreateDateColumn()
  created_at: Date;
}
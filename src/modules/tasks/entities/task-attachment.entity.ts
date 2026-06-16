import { 
  Entity, 
  PrimaryGeneratedColumn, 
  Column, 
  CreateDateColumn, 
} from 'typeorm';

@Entity('task_attachment')
export class TaskAttachment {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({nullable : true})   
  taskId : number;

  @Column({nullable :true})   
  userId : number;

  @Column({nullable :true})   
  file_name : string;

  @Column({nullable :true})
  file_url : string;

  @Column({ nullable: true })
  file_type : string;

  @Column({ nullable: true })
  file_size: number;

  @CreateDateColumn()
  createdAt: Date;
}
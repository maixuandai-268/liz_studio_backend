import { 
  Entity, 
  PrimaryGeneratedColumn, 
  Column, 
  CreateDateColumn, 
  UpdateDateColumn, 
  OneToOne, 
  OneToMany, 
  JoinColumn
} from 'typeorm';
import { Notification } from '../../notifications/entities/notification.entity';
import { Employee } from '@/modules/employee/entities/emplyee.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ default: 'employee' })
  role: 'employee' | 'admin';

  @Column({nullable : true})   
  employee_code : string;

  @Column({nullable :true})   
  email : string;

  @Column()
  password: string;

  @Column({default : true}) 
  isActive : boolean;

  @Column({ nullable: true })
  refresh_token: string;

  @Column({ nullable: true })
  last_login: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToOne(() => Employee, (employee) => employee.user)
  employee: Employee;

  @OneToMany(() => Notification, (notification) => notification.user)
  notifications: Notification[];
}
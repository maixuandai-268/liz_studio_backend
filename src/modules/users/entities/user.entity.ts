/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable prettier/prettier */
import { 
  Entity, 
  PrimaryGeneratedColumn, 
  Column, 
  CreateDateColumn, 
  UpdateDateColumn, 
  OneToOne, 
  OneToMany 
} from 'typeorm';
import { Notification } from '../../notifications/entities/notification.entity';

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
  password_hash: string;

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

  @OneToMany(() => Notification, (notification) => notification.user)
  notifications: Notification[];
}
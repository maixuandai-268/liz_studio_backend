/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable prettier/prettier */
import { User } from 'src/modules/users/user.entity';
import { 
  Entity, 
  PrimaryGeneratedColumn, 
  Column, 
  CreateDateColumn, 
  UpdateDateColumn, 
  OneToOne, 
  OneToMany 
} from 'typeorm';

@Entity('employee')
export class Employee {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({nullable : true})   
  userId : number;

  @Column({nullable :true})   
  full_name : string;

  @Column()
  avatar_url: string;

  @Column({default : true}) 
  phone : string;

  @Column({ nullable: true })
  position: string;

  @Column({ default: false })
  employment_status: boolean;

  @Column({ nullable: true })
  level_id: number;

  @Column({ nullable: true })
  hire_date: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToOne(() => User, (user) => user.id)
  user: User;

  @OneToOne(() => Level, (level) => level.id)
  level: Level;
}
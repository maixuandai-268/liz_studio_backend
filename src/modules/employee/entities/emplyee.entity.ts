import { User } from '../../users/entities/user.entity';
import { Level } from '../../levels/entities/levels.entity';
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

@Entity('employee')
export class Employee {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({nullable :true})   
  full_name : string;

  @Column({nullable :true})
  avatar_url: string;

  @Column({default : true}) 
  phone : string;

  @Column({ nullable: true })
  position: string;

  @Column({ default: false })
  employment_status: boolean;

  @Column({ nullable: true })
  level_id: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true, default: null })
  base_salary: number;

  @Column({ nullable: true })
  hire_date: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column()
  userId: number;
  @OneToOne(() => Level, (level) => level.id)
  level: Level;
}
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Task } from '../../tasks/entities/task.entity';
import { KpiProductType } from './kpi-product-type.entity';

@Entity('employee_kpis')
export class EmployeeKpi {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id' })
  userId: number;

  @Column({ name: 'task_id' })
  taskId: number;

  @Column({ name: 'product_type_id' })
  productTypeId: number;

  @Column({ length: 50 })
  phase: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  points: number;

  @Column({ name: 'achieved_date', type: 'date' })
  achievedDate: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Task)
  @JoinColumn({ name: 'task_id' })
  task: Task;

  @ManyToOne(() => KpiProductType)
  @JoinColumn({ name: 'product_type_id' })
  productType: KpiProductType;
}


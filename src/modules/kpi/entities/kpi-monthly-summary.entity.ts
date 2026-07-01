import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('kpi_monthly_summaries')
export class KpiMonthlySummary {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id' })
  userId: number;

  @Column()
  month: number;

  @Column()
  year: number;

  @Column({ name: 'total_points', type: 'decimal', precision: 10, scale: 2, nullable: true })
  totalPoints: number;

  @Column({ name: 'target_points', type: 'decimal', precision: 10, scale: 2, nullable: true })
  targetPoints: number;

  @Column({ name: 'productivity_percent', type: 'decimal', precision: 10, scale: 2, nullable: true })
  productivityPercent: number;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;
}


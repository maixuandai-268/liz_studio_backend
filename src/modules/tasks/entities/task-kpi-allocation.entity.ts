import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('task_kpi_allocation')
export class TaskKpiAllocation {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  taskId: number;

  @Column()
  userId: number;

  @Column()
  phase: string; // 'v1' | 'v2' | 'v3'

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  points: number;

  @Column({ default: false })
  is_main: boolean;

  @CreateDateColumn()
  createdAt: Date;
}

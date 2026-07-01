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
  phase: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  points: number;

  @Column({ default: false })
  is_main: boolean;

  @CreateDateColumn()
  createdAt: Date;
}


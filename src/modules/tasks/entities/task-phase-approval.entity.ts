import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('task_phase_approvals')
export class TaskPhaseApproval {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  taskId: number;

  @Column()
  phase: string;

  @Column({ default: 'pending' })
  status: string; // pending | approved | rejected

  @Column()
  requested_by: number;

  @Column({ nullable: true })
  reviewed_by: number;

  @Column({ nullable: true })
  reviewed_at: Date;

  @Column({ nullable: true })
  reason: string;

  @CreateDateColumn()
  createdAt: Date;
}

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('attendance_records')
export class AttendanceRecord {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id' })
  userId: number;

  @Column({ name: 'attendance_date', type: 'date' })
  attendanceDate: string;

  @Column({ name: 'check_in', type: 'timestamp' })
  checkIn: Date;

  @Column({ name: 'check_out', type: 'timestamp' })
  checkOut: Date;

  @Column({ length: 50, nullable: true })
  status: string;

  @Column({ name: 'late_minutes', default: 0 })
  lateMinutes: number;

  @Column({ name: 'working_minutes', default: 0 })
  workingMinutes: number;

  @Column({ name: 'evidence_url', length: 255, nullable: true })
  evidenceUrl: string;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ name: 'approved_by', nullable: true })
  approvedBy: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'approved_by' })
  approver: User;
}

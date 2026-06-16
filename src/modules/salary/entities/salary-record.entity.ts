import { 
  Entity, 
  PrimaryGeneratedColumn, 
  Column, 
  CreateDateColumn, 
} from 'typeorm';

@Entity('salary_record')
export class SalaryRecord {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({nullable : true})   
  period_id : number;

  @Column({nullable :true})   
  userId : number;

  @Column({nullable :true})   
  level_id : number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  salary_coefficient: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  base_salary: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  kpi_points: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  kpi_target: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  productivity_percentage: number;

    @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
    gross_salary: number;

    @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
    deductions: number;

    @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
    net_salary: number;

    @Column({ default: 'pending' })
    status: string;

    @Column({ nullable: true })
    notes: string;

    @Column({ nullable: true })
    approved_by: number;

    @Column({ nullable: true })
    approved_at: Date;

  @CreateDateColumn()
  createdAt: Date;
}
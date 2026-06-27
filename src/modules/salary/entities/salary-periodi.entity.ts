import { 
  Entity, 
  PrimaryGeneratedColumn, 
  Column, 
  CreateDateColumn, 
} from 'typeorm';

@Entity('salary_period')
export class SalaryPeriod {
  @PrimaryGeneratedColumn()
  id: number;

@Column({ nullable : true})
    name: string;

    @Column({ nullable: true })
    month: number;

        @Column({ nullable: true })
    year: number;

    @Column({ nullable: true })
    quarter: number;

    @Column({ nullable: true })
    pay_date: Date;



  @Column({ default: 'pending' })   
  status : string;

  @Column({nullable :true})   
  created_by : number;

  @CreateDateColumn()
  created_at: Date;
}
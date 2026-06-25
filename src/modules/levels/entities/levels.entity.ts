import { 
  Entity, 
  PrimaryGeneratedColumn, 
  Column, 
  CreateDateColumn, 
} from 'typeorm';

@Entity('levels')
export class Level {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({nullable : true})   
  name : string;

  @Column({nullable :true})   
  description : string;

  @Column({ type: 'float', nullable: true })
  kpi_target: number;

  @Column({ nullable: true })
  salary_coefficient: number;
}

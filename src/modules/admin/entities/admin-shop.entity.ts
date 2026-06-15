/* eslint-disable prettier/prettier */
import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';
@Entity('shops') 
export class AdminShopEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  shop_name: string;

  @Column()
  owner_name: string; 

  @Column()
  owner_email: string;

  @Column({ default: 0 })
  docs_count: number; 

  @Column({ default: 'pending' })
  status: string; 

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  submitted_at: Date; 

  @Column({ nullable: true })
  reject_reason?: string; 
}
import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('kpi_product_types')
export class KpiProductType {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 100 })
  name: string;

  @Column({ name: 'base_points', type: 'decimal', precision: 10, scale: 2 })
  basePoints: number;

  @Column({ name: 'v1_percent', type: 'decimal', precision: 5, scale: 2, nullable: true })
  v1Percent: number;

  @Column({ name: 'v2_percent', type: 'decimal', precision: 5, scale: 2, nullable: true })
  v2Percent: number;

  @Column({ name: 'fn_percent', type: 'decimal', precision: 5, scale: 2, nullable: true })
  fnPercent: number;
}


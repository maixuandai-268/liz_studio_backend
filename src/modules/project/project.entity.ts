/* eslint-disable prettier/prettier */
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('project')
export class Project {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  projectName: string;

  @Column({ nullable: true })
  year: number;

  @Column('text')
  backgroundImage: string;

  @Column({ type: 'text', nullable: true })
  clientName: string;

  @Column({ type: 'text', nullable: true })
  locationName: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'text', nullable: true })
  images: string[];

  @CreateDateColumn()
  createdAt: Date;
}


import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AttendanceRecord } from './entities/attendance-records.entity';

@Module({
  imports: [TypeOrmModule.forFeature([AttendanceRecord])],
})
export class AttendanceModule {}

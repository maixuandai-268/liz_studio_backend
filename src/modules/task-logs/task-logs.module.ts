import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TaskLog } from './entities/task-log.entity';
import { TaskLogsService } from './task-logs.service';
import { RealtimeModule } from '@/modules/realtime/realtime.module';

@Module({
  imports: [TypeOrmModule.forFeature([TaskLog]), RealtimeModule],
  providers: [TaskLogsService],
  exports: [TaskLogsService],
})
export class TaskLogsModule {}

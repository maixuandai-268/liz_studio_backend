import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Level } from './entities/levels.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Level])],
})
export class LevelsModule {}

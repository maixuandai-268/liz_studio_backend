import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TaskComment } from '../entities/task-comment.entity';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';

@Controller('tasks/:taskId/comments')
@UseGuards(JwtAuthGuard)
export class TaskCommentsController {
  constructor(
    @InjectRepository(TaskComment)
    private commentRepo: Repository<TaskComment>,
  ) {}

  @Get()
  async findAll(@Param('taskId') taskId: string) {
    return this.commentRepo.find({
      where: { taskId: Number(taskId) } as any,
      order: { createdAt: 'ASC' },
    });
  }

  @Post()
  async create(
    @Param('taskId') taskId: string,
    @Body() body: { content: string; userId?: number },
  ) {
    const comment = this.commentRepo.create({
      taskId: Number(taskId),
      content: body.content,
      userId: body.userId ?? 0,
    } as any);
    return this.commentRepo.save(comment);
  }
}

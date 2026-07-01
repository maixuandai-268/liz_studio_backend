import { Controller, Get, Post, Param, Body, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { TaskCommentsService } from './task-comments.service';

@Controller('tasks/:taskId/comments')
@UseGuards(JwtAuthGuard)
export class TaskCommentsController {
  constructor(private readonly taskCommentsService: TaskCommentsService) {}

  @Get()
  async findAll(@Param('taskId') taskId: string) {
    return this.taskCommentsService.findAll(Number(taskId));
  }

  @Post()
  async create(
    @Param('taskId') taskId: string,
    @Body() body: { content: string },
    @Request() req: any
  ) {
    const userId = req.user.id;
    return this.taskCommentsService.create(Number(taskId), userId, body.content);
  }
}


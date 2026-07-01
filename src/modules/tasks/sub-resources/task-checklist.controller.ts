import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { TasksChecklistsService } from './tasks-checklists.service';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';

@Controller('tasks/:taskId/checklist')
@UseGuards(JwtAuthGuard)
export class TaskChecklistController {
  constructor(
    private readonly service: TasksChecklistsService,
  ) {}

  @Get()
  findAll(@Param('taskId') taskId: string) {
    return this.service.findAll(Number(taskId));
  }

  @Post()
  create(
    @Param('taskId') taskId: string,
    @Body() body: { content: string },
  ) {
    return this.service.create(Number(taskId), body.content);
  }

  @Patch(':id')
  toggle(@Param('id') id: string) {
    return this.service.toggle(Number(id));
  }
}


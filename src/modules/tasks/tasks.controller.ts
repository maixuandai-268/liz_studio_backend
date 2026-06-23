import { Controller, Get, Post, Param, Patch, Delete, Body, UsePipes, ValidationPipe, Query, Req, UseGuards } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { CreateCategoryDto } from './dto/create_category.dto';
import { Request } from 'express';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';

@Controller('tasks')
@UseGuards(JwtAuthGuard)
export class TaskController {
  constructor(private readonly taskService: TasksService) { }

  @Post('category')
  createCategory(@Body() ctg : CreateCategoryDto) {
    return this.taskService.createCategory(ctg)
  }

  @Get('category')
  async getAllCategory() {
      return await this.taskService.getCategory();
  }

  @Post()
  create(@Body() createTaskDto: any) {
    // FE sends project_id inside body
    const projectId = String(createTaskDto.project_id);
    return this.taskService.createTask(projectId, createTaskDto);
  }

  @Get('project/:projectId')
  getProjectTasks(@Param('projectId') projectId: string) {
    return this.taskService.getProjectTasks(projectId);
  }

  @Get(':id')
  getTask(@Param('id') id: string) {
    return this.taskService.getTask(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string, 
    @Body() updateTaskDto: any,
  ) {
    // projectId optional, fallback in service
    return this.taskService.updateTask(
      id, 
      updateTaskDto,
      undefined,
      undefined,
      String(updateTaskDto.project_id || '')
    );
  }

  @Patch('move/:id')
  moveTask(
    @Param('id') id: string, 
    @Body() moveDto: { status: string; project_id?: number }
  ) {
    return this.taskService.moveTask(
      id, 
      { status: moveDto.status },
      String(moveDto.project_id || '')
    );
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Query('projectId') projectId?: string) {
    return this.taskService.deleteTask(id, projectId);
  }

  // Assign member to task
  @Post(':id/assign')
  async assignTask(
    @Param('id') id: string,
    @Body() body: { userId: number },
  ) {
    return this.taskService.assignTask(id, body.userId);
  }

  // Unassign member from task
  @Delete(':id/assign/:userId')
  async unassignTask(
    @Param('id') id: string,
    @Param('userId') userId: string,
  ) {
    return this.taskService.unassignTask(id, Number(userId));
  }

  // Approve V1
  @Patch(':id/approve')
  async approveV1(@Param('id') id: string) {
    return this.taskService.approveV1(id);
  }

  // Get all employees for assign dropdown
  @Get('employees/all')
  async getEmployees() {
    return this.taskService.getEmployees();
  }
}
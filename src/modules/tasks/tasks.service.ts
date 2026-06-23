import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Task } from './entities/task.entity';
import { TaskAssignee } from './entities/task-assignee.entity';
import { TaskAttachment } from './entities/task-attachment.entity';
import { RealtimeService } from '@/modules/realtime/realtime.service';
import { TaskLogsService } from '@/modules/task-logs/task-logs.service';
import { CreateCategoryDto } from './dto/create_category.dto';
import { Task_Categories } from './entities/categories.entity';
import { Employee } from '@/modules/employee/entities/emplyee.entity';

@Injectable()
export class TasksService {
  private logger = new Logger('TasksService');

  constructor(
    @InjectRepository(Task)
    private taskRepository: Repository<Task>,
    @InjectRepository(Task_Categories)
    private categoryRepository: Repository<Task_Categories>,
    @InjectRepository(TaskAssignee)
    private assigneeRepository: Repository<TaskAssignee>,
    @InjectRepository(TaskAttachment)
    private attachmentRepository: Repository<TaskAttachment>,
    @InjectRepository(Employee)
    private employeeRepository: Repository<Employee>,
    private realtimeService: RealtimeService,
    private taskLogsService: TaskLogsService,
  ) {}

  async createTask(projectId: string, createTaskDto: any) {
    try {
      const projectIdNum = parseInt(projectId, 10);

      const task = this.taskRepository.create({
        ...createTaskDto,
        project_id: projectIdNum,
        start_date: new Date(),
      } as any);

      const saved = (await this.taskRepository.save(task)) as unknown as Task;

      this.realtimeService.emitTaskEvent(projectId, 'created', {
        id: saved.id,
        title: saved.title,
        description: saved.description,
        status: saved.status,
        priority: saved.priority,
        createdAt: saved.createdAt,
      });

      this.logger.log(`[TASK] Created: ${saved.id} in project ${projectId}`);
      return saved;
    } catch (error) {
      this.logger.error(`[TASK] Create failed: ${error}`);
      throw error;
    }
  }

  async getTask(taskId: string) {
    const taskIdNum = parseInt(taskId, 10);

    const task = await this.taskRepository.findOne({
      where: { id: taskIdNum } as any,
    });

    if (!task) {
      throw new NotFoundException(`Task ${taskId} not found`);
    }

    // Attach assignees
    const assignees = await this.assigneeRepository.find({ where: { taskId: taskIdNum } as any });
    const assigneeInfos = await Promise.all(
      assignees.map(async (a) => {
        const emp = await this.employeeRepository.findOne({ where: { userId: a.userId } as any });
        return {
          userId: a.userId,
          full_name: emp?.full_name || 'Unknown',
          avatar_url: emp?.avatar_url || '',
          assignedAt: a.assignedAt,
        };
      }),
    );

    // Attach attachments
    const attachments = await this.attachmentRepository.find({ where: { taskId: taskIdNum } as any });

    return { ...task, assignees: assigneeInfos, attachments };
  }

  async getProjectTasks(projectId: string) {
    const projectIdNum = parseInt(projectId, 10);

    const tasks = await this.taskRepository.find({
      where: {
        project_id: projectIdNum,
      } as any,
      order: {
        createdAt: 'DESC',
      } as any,
    });

    // Attach assignee info for each task
    const tasksWithAssignees = await Promise.all(
      tasks.map(async (task) => {
        const assignees = await this.assigneeRepository.find({ where: { taskId: task.id } as any });
        const assigneeInfos = await Promise.all(
          assignees.map(async (a) => {
            const emp = await this.employeeRepository.findOne({ where: { userId: a.userId } as any });
            return {
              userId: a.userId,
              full_name: emp?.full_name || 'Unknown',
              avatar_url: emp?.avatar_url || '',
            };
          }),
        );
        return { ...task, assignees: assigneeInfos };
      }),
    );

    return tasksWithAssignees;
  }

  

  async updateTask(
    taskId: string,
    updateTaskDto: any,
    userId?: string,
    userName?: string,
    projectId?: string,
  ) {
    try {
      const task = await this.getTask(taskId);
      const resolvedProjectId = projectId || String(task.project_id);
      const oldValues = { ...task };

      Object.assign(task, updateTaskDto);
      const updated = (await this.taskRepository.save(task)) as Task;

      const changes = [];
      for (const key of Object.keys(updateTaskDto)) {
        if (oldValues[key] !== updateTaskDto[key]) {
          changes.push({
            field: key,
            oldValue: oldValues[key],
            newValue: updateTaskDto[key],
          });
        }
      }

      await this.taskLogsService.createLog(
        resolvedProjectId,
        taskId,
        'updated',
        userId || 'system',
        userName || 'System',
        changes,
      );

      this.realtimeService.emitTaskEvent(resolvedProjectId, 'updated', {
        id: updated.id,
        title: updated.title,
        description: updated.description,
        status: updated.status,
        priority: updated.priority,
        updatedAt: updated.updatedAt,
      });

      this.logger.log(
        `[TASK] Updated: ${updated.id} in project ${resolvedProjectId}`,
      );
      return updated;
    } catch (error) {
      this.logger.error(`[TASK] Update failed: ${error}`);
      throw error;
    }
  }

  async moveTask(
    taskId: string,
    moveDto: { status: string },
    projectId?: string,
  ) {
    try {
      const task = await this.getTask(taskId);
      const resolvedProjectId = projectId || String(task.project_id);
      const oldStatus = task.status;

      task.status = moveDto.status;

      const updated = (await this.taskRepository.save(task)) as unknown as Task;

      this.realtimeService.emitTaskEvent(resolvedProjectId, 'moved', {
        id: updated.id,
        title: updated.title,
        oldStatus,
        newStatus: updated.status,
        movedAt: new Date().toISOString(),
      });

      this.logger.log(
        `[TASK] Moved: ${updated.id} from ${oldStatus} to ${updated.status}`,
      );
      return updated;
    } catch (error) {
      this.logger.error(`[TASK] Move failed: ${error}`);
      throw error;
    }
  }

  async deleteTask(taskId: string, projectId?: string) {
    try {
      const task = await this.getTask(taskId);
      const resolvedProjectId = projectId || String(task.project_id);

      await this.taskRepository.remove(task);

      this.realtimeService.emitTaskEvent(resolvedProjectId, 'deleted', {
        id: taskId,
        title: task.title,
        deletedAt: new Date().toISOString(),
      });

      this.logger.log(
        `[TASK] Deleted: ${taskId} from project ${resolvedProjectId}`,
      );
      return { success: true };
    } catch (error) {
      this.logger.error(`[TASK] Delete failed: ${error}`);
      throw error;
    }
  }



  // Assign member to task
  async assignTask(taskId: string, userId: number) {
    const existing = await this.assigneeRepository.findOne({ where: { taskId: Number(taskId), userId } as any });
    if (existing) return existing;

    const assignee = this.assigneeRepository.create({ taskId: Number(taskId), userId } as any);
    return this.assigneeRepository.save(assignee);
  }

  // Unassign member from task
  async unassignTask(taskId: string, userId: number) {
    const assignee = await this.assigneeRepository.findOne({ where: { taskId: Number(taskId), userId } as any });
    if (assignee) {
      await this.assigneeRepository.remove(assignee);
    }
    return { success: true };
  }

  // Approve V1 — set status to 'v1'
  async approveV1(taskId: string) {
    const task = await this.getTask(taskId);
    task.status = 'v1';
    const updated = (await this.taskRepository.save(task)) as unknown as Task;

    this.realtimeService.emitTaskEvent(String(task.project_id), 'updated', {
      id: updated.id,
      status: updated.status,
      updatedAt: updated.updatedAt,
    });

    return updated;
  }

  // Get all employees for assign dropdown
  async getEmployees() {
    return this.employeeRepository.find({});
  }

  async createCategory(ctg : CreateCategoryDto ) {
    return await this.categoryRepository.save(ctg as any);
  }

  async getCategory() { 
   return this.categoryRepository.find({});
  }
}

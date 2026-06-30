import { Injectable, Logger, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Task } from './entities/task.entity';
import { TaskAssignee } from './entities/task-assignee.entity';
import { TaskKpiAllocation } from './entities/task-kpi-allocation.entity';
import { TaskAttachment } from './entities/task-attachment.entity';
import { RealtimeService } from '@/modules/realtime/realtime.service';
import { TaskLogsService } from '@/modules/task-logs/task-logs.service';
import { CreateCategoryDto } from './dto/create_category.dto';
import { Task_Categories } from './entities/categories.entity';
import { Employee } from '@/modules/employee/entities/emplyee.entity';
import { TaskPhaseApproval } from './entities/task-phase-approval.entity';
import { KpiService } from '@/modules/kpi/kpi.service';
import { NotificationTriggersService } from '@/modules/notifications/notification-triggers.service';

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
    @InjectRepository(TaskKpiAllocation)
    private kpiAllocRepo: Repository<TaskKpiAllocation>,
    @InjectRepository(TaskAttachment)
    private attachmentRepository: Repository<TaskAttachment>,
    @InjectRepository(Employee)
    private employeeRepository: Repository<Employee>,
    @InjectRepository(TaskPhaseApproval)
    private phaseApprovalRepo: Repository<TaskPhaseApproval>,
    private realtimeService: RealtimeService,
    private taskLogsService: TaskLogsService,
    private kpiService: KpiService,
    private notificationTriggers: NotificationTriggersService,
  ) {}


  private readonly PHASE_ORDER = ['todo', 'wip', 'review', 'v1', 'v2', 'done'];

  async requestPhase(taskId: string, userId: number, targetPhase?: string) {
    const task = await this.getTask(taskId);
    const nextPhase = targetPhase || (() => {
      const idx = this.PHASE_ORDER.indexOf(task.status);
      if (idx < 0 || idx >= this.PHASE_ORDER.length - 1) {
        throw new BadRequestException('KhÃ´ng thá»ƒ chuyá»ƒn phase tá»« tráº¡ng thÃ¡i hiá»‡n táº¡i');
      }
      return this.PHASE_ORDER[idx + 1];
    })();

    const approval = this.phaseApprovalRepo.create({
      taskId: Number(taskId),
      phase: nextPhase,
      status: 'pending',
      requested_by: userId,
    } as any);
    await this.phaseApprovalRepo.save(approval as any);

    task.pending_approval = true;
    task.previous_phase = task.status;
    task.status = nextPhase;
    await this.taskRepository.save(task as any);

    await this.taskLogsService.createLog(
      String(task.project_id),
      taskId,
      'phase_requested',
      String(userId),
      'User #' + userId,
      [{ field: 'phase', oldValue: task.previous_phase, newValue: nextPhase }],
    );

    const fullTask = await this.getTask(taskId);
    this.realtimeService.emitTaskEvent(String(task.project_id), 'updated', fullTask);

    return { task: fullTask, approval };
  }

  private async recalculateAllKpi(taskId: number) {
    await this.kpiAllocRepo.delete({ taskId } as any);
    await this.taskRepository.manager.connection.query(
      `DELETE FROM employee_kpis WHERE task_id = $1`,
      [taskId],
    );
  }

private async autoAllocateKpiOnApproval(task: Task, newStatus: string, oldStatus: string) {
    if (newStatus !== 'done') return;
    if (oldStatus === 'done') return;
    const taskIdNum = Number(task.id);
    if (!taskIdNum) return;
    const totalPoints = Number(task.story_points) || 0;
    if (totalPoints <= 0) return;
    const assignees = await this.assigneeRepository.find({ where: { taskId: taskIdNum } } as any);
    const main = assignees.find((a: any) => a.is_main);
    if (!main) return;
    // Neu co supporter -> skip auto, cho admin nhap tay
    const supporters = assignees.filter((a: any) => !a.is_main);
    if (supporters.length > 0) return;
    const ptRows = await this.taskRepository.manager.connection.query(
      'SELECT id FROM kpi_product_types ORDER BY id LIMIT 1',
    );
    const productTypeId = ptRows.length > 0 ? Number(ptRows[0].id) : 1;
    const alloc = this.kpiAllocRepo.create({
      taskId: taskIdNum,
      userId: main.userId,
      phase: 'final',
      points: totalPoints,
      is_main: true,
    } as any);
    const saved = await this.kpiAllocRepo.save(alloc as any);
    await this.writeKpiRecords(taskIdNum, 'final', [saved] as unknown as TaskKpiAllocation[], productTypeId);
    this.logger.log('[KPI] Auto-allocated ' + totalPoints + ' pts to user ' + main.userId + ' for task ' + taskIdNum + ' (no supporters)');
  }

  async approvePhase(
  taskId: string,
  reviewerId?: number,
  targetStatus?: string,
) {
  const task = await this.getTask(taskId);

  if (!task.pending_approval) {
    throw new BadRequestException(
      'Task khÃ´ng cÃ³ yÃªu cáº§u duyá»‡t',
    );
  }

  const approval = await this.phaseApprovalRepo.findOne({
    where: {
      taskId: Number(taskId),
      status: 'pending',
    } as any,
    order: {
      createdAt: 'DESC',
    } as any,
  });

  if (!approval) {
    throw new NotFoundException(
      'KhÃ´ng tÃ¬m tháº¥y yÃªu cáº§u duyá»‡t',
    );
  }

  const oldStatus = task.status;

  approval.status = 'approved';
  approval.reviewed_by = reviewerId || 0;
  approval.reviewed_at = new Date();

  await this.phaseApprovalRepo.save(
    approval as any,
  );

  task.pending_approval = false;
  task.previous_phase = null;

  if (targetStatus) {
    task.status = targetStatus;
  }

  await this.taskRepository.save(task as any);

  await this.taskLogsService.createLog(
    String(task.project_id),
    taskId,
    'phase_approved',
    String(reviewerId || 'system'),
    'Admin',
    [
      {
        field: 'phase',
        oldValue: oldStatus,
        newValue: task.status,
      },
    ],
  );

  await this.autoAllocateKpiOnApproval(task, task.status, oldStatus);

  if (task.status === 'done') {
    this.fireTaskCompletedNotif(task).catch(e => this.logger.error(`[NOTIF] ${e.message}`));
  }

  const fullTask = await this.getTask(taskId);

  this.realtimeService.emitTaskEvent(
    String(task.project_id),
    'updated',
    fullTask,
  );

  this.realtimeService.emitTaskEvent(
    String(task.project_id),
    'moved',
    {
      id: fullTask.id,
      title: fullTask.title,
      oldStatus,
      newStatus: task.status,
      movedAt: new Date().toISOString(),
    },
  );

  this.logger.log(
    `[TASK] Approved: ${taskId} ${oldStatus} -> ${task.status}`,
  );

  return {
    task: fullTask,
    approval,
  };
}

  async requestRevision(taskId: string, userId: number, reason: string) {
    const task = await this.getTask(taskId);

    const currentIdx = this.PHASE_ORDER.indexOf(task.status);
    if (currentIdx <= 0) {
      throw new BadRequestException('KhÃ´ng thá»ƒ yÃªu cáº§u sá»­a á»Ÿ tráº¡ng thÃ¡i nÃ y');
    }
    const revertPhase = task.previous_phase || this.PHASE_ORDER[currentIdx - 1];

    const pendingApproval = await this.phaseApprovalRepo.findOne({
      where: { taskId: Number(taskId), status: 'pending' } as any,
      order: { createdAt: 'DESC' } as any,
    });
    if (pendingApproval) {
      pendingApproval.status = 'rejected';
      pendingApproval.reason = reason;
      pendingApproval.reviewed_by = userId;
      pendingApproval.reviewed_at = new Date();
      await this.phaseApprovalRepo.save(pendingApproval as any);
    }

    task.status = revertPhase;
    task.pending_approval = false;
    task.previous_phase = null;
    task.revision_requested = true;
    task.revision_reason = reason;
    await this.taskRepository.save(task as any);

    await this.taskLogsService.createLog(
      String(task.project_id),
      taskId,
      'revision_requested',
      String(userId),
      'User #' + userId,
      [{ field: 'phase', oldValue: task.status, newValue: revertPhase }, { field: 'reason', oldValue: '', newValue: reason }],
    );

    const fullTask = await this.getTask(taskId);
    this.realtimeService.emitTaskEvent(String(task.project_id), 'updated', fullTask);

    // Notify revision requested cho main assignee
    this.fireRevisionRequestedNotif(taskId, reason).catch(e => this.logger.error(`[NOTIF] ${e.message}`));

    return { task: fullTask, reason };
  }

  
  async revisionCompleted(taskId: string) {
    const task = await this.getTask(taskId);
    if (!task.revision_requested) {
      throw new BadRequestException('Task khÃ´ng cÃ³ yÃªu cáº§u sá»­a nÃ o');
    }

    task.revision_requested = false;
    task.revision_reason = null;
    task.pending_approval = false;
    await this.taskRepository.save(task as any);

    await this.taskLogsService.createLog(
      String(task.project_id),
      taskId,
      'revision_completed',
      'employee',
      'NhÃ¢n viÃªn',
      [{ field: 'revision', oldValue: 'requested', newValue: 'completed' }],
    );

    const fullTask = await this.getTask(taskId);
    this.realtimeService.emitTaskEvent(String(task.project_id), 'updated', fullTask);

    return { task: fullTask, message: 'ÄÃ£ hoÃ n thÃ nh sá»­a, chá» admin duyá»‡t' };
  }

  async getPhaseApprovals(taskId: string) {
    return this.phaseApprovalRepo.find({
      where: { taskId: Number(taskId) } as any,
      order: { createdAt: 'DESC' } as any,
    });
  }

  async createTask(projectId: string, createTaskDto: any) {
    try {
      const projectIdNum = parseInt(projectId, 10);

      const task = this.taskRepository.create({
        ...createTaskDto,
        project_id: projectIdNum,
        start_date: new Date(),
      } as any);

      const saved = (await this.taskRepository.save(task)) as unknown as Task;

      const fullTask = await this.getTask(String(saved.id));
      this.realtimeService.emitTaskEvent(projectId, 'created', fullTask);

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
      relations: { category: true, project: true } as any,
    });

    if (!task) {
      throw new NotFoundException(`Task ${taskId} not found`);
    }

    const assignees = await this.assigneeRepository.find({ where: { taskId: taskIdNum } as any });
    const assigneeInfos = await Promise.all(
      assignees.map(async (a) => {
        const emp = await this.employeeRepository.findOne({ where: { userId: a.userId } as any });
        return {
          userId: a.userId,
          full_name: emp?.full_name || 'Unknown',
          avatar_url: emp?.avatar_url || '',
          assignedAt: a.assignedAt,
          is_main: a.is_main,
        };
      }),
    );

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
      relations: { category: true, project: true } as any,
    });


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
              is_main: a.is_main,
            };
          }),
        );
        const attachments = await this.attachmentRepository.find({ where: { taskId: task.id } as any });
        return { ...task, assignees: assigneeInfos, attachments };
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

      // Strip undefined/null values to avoid FK violations
      const cleanDto = Object.fromEntries(
        Object.entries(updateTaskDto).filter(([_, v]) => v !== undefined && v !== null),
      );
      Object.assign(task, cleanDto);
      if ('category_id' in cleanDto) (task as any).category = null;
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

      if ('story_points' in updateTaskDto && oldValues['story_points'] !== updateTaskDto['story_points']) {
        await this.recalculateAllKpi(task.id);
      }

      await this.taskLogsService.createLog(
        resolvedProjectId,
        taskId,
        'updated',
        userId || 'system',
        userName || 'System',
        changes,
      );

      const fullTask = await this.getTask(taskId);
      this.realtimeService.emitTaskEvent(resolvedProjectId, 'updated', fullTask);

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
  userId: number,
  role: string,
  projectId?: string,
) {
  try {
    const task = await this.getTask(taskId);

    const resolvedProjectId = projectId || String(task.project_id);
    const oldStatus = task.status;
    const newStatus = moveDto.status;

    if (role === 'admin') {
      if (task.pending_approval) {
        task.pending_approval = false;
      }
      task.status = newStatus;
      const updated = await this.taskRepository.save(task as any);

      await this.taskLogsService.createLog(
        resolvedProjectId,
        taskId,
        'phase_changed',
        String(userId),
        role,
        [{ field: 'phase', oldValue: oldStatus, newValue: newStatus }],
      );

      await this.autoAllocateKpiOnApproval(task, newStatus, oldStatus);

      // Notify khi task hoàn thành
      if (newStatus === 'done') {
        this.fireTaskCompletedNotif(task).catch(e => this.logger.error(`[NOTIF] ${e.message}`));
      }

      const fullTask = await this.getTask(taskId);
      this.realtimeService.emitTaskEvent(resolvedProjectId, 'updated', fullTask);
      this.realtimeService.emitTaskEvent(resolvedProjectId, 'moved', {
        id: fullTask.id,
        title: fullTask.title,
        oldStatus,
        newStatus,
        movedAt: new Date().toISOString(),
      });
      this.logger.log(`[TASK] ${taskId}: ${oldStatus} -> ${newStatus}`);
      return fullTask;
    }

    task.status = newStatus;

    const updated = await this.taskRepository.save(task as any);

    await this.taskLogsService.createLog(
      resolvedProjectId,
      taskId,
      'phase_changed',
      String(userId),
      role,
      [
        {
          field: 'phase',
          oldValue: oldStatus,
          newValue: newStatus,
        },
      ],
    );

    const fullTask = await this.getTask(taskId);

    this.realtimeService.emitTaskEvent(
      resolvedProjectId,
      'updated',
      fullTask,
    );

    this.realtimeService.emitTaskEvent(
      resolvedProjectId,
      'moved',
      {
        id: fullTask.id,
        title: fullTask.title,
        oldStatus,
        newStatus,
        movedAt: new Date().toISOString(),
      },
    );

    this.logger.log(
      `[TASK] ${taskId}: ${oldStatus} -> ${newStatus}`,
    );

    return fullTask;
  } catch (err) {
    this.logger.error(err);
    throw err;
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


  async assignTask(taskId: string, userId: number, isMain: boolean = false) {
    const taskIdNum = Number(taskId);

    if (isMain) {
      await this.assigneeRepository.update(
        { taskId: taskIdNum, is_main: true } as any,
        { is_main: false } as any,
      );
    }

    const existing = await this.assigneeRepository.findOne({ where: { taskId: taskIdNum, userId } as any });
    if (existing) {
      existing.is_main = isMain;
      return this.assigneeRepository.save(existing);
    }

    const assignee = this.assigneeRepository.create({ taskId: taskIdNum, userId, is_main: isMain } as any);
    const saved = await this.assigneeRepository.save(assignee);

    // Notify new task assigned
    this.fireNewTaskAssignedNotif(taskIdNum, userId).catch(e => this.logger.error(`[NOTIF] ${e.message}`));

    return saved;
  }


  async unassignTask(taskId: string, userId: number) {
    const assignee = await this.assigneeRepository.findOne({ where: { taskId: Number(taskId), userId } as any });
    if (assignee) {
      await this.assigneeRepository.remove(assignee);
    }
    return { success: true };
  }


  async allocateKpi(
    taskId: string,
    supporterAllocations: { userId: number; points: number }[],
  ) {
    try {
      const taskIdNum = Number(taskId);
      const phase = 'final';
      const task = await this.getTask(taskId);
      const totalPoints = Number(task.story_points) || 0;

      // Find a valid product_type_id from employee_kpis or default
      const ptRows = await this.taskRepository.manager.connection.query(
        `SELECT id FROM kpi_product_types ORDER BY id LIMIT 1`,
      );
      const productTypeId = ptRows.length > 0 ? Number(ptRows[0].id) : 1;

      // Validate: supporter points must not exceed total
      const supporterSum = supporterAllocations.reduce((s, a) => s + a.points, 0);
      if (supporterSum > totalPoints) {
        throw new BadRequestException(`Äiá»ƒm há»— trá»£ (${supporterSum}) vÆ°á»£t quÃ¡ tá»•ng Ä‘iá»ƒm task (${totalPoints})`);
      }

      // Find main assignee
      const assignees = await this.assigneeRepository.find({ where: { taskId: taskIdNum } } as any);
      const main = assignees.find((a: any) => a.is_main);
      const mainPoints = Math.round((totalPoints - supporterSum) * 100) / 100;

      // Delete old allocations + records (use raw SQL for consistent column naming)
      await this.taskRepository.manager.connection.query(
        `DELETE FROM task_kpi_allocation WHERE "taskId" = $1 AND phase = $2`,
        [taskIdNum, phase],
      );
      await this.taskRepository.manager.connection.query(
        `DELETE FROM employee_kpis WHERE task_id = $1 AND phase = $2`,
        [taskIdNum, phase],
      );

      const savedAllocs: TaskKpiAllocation[] = [];

      // Save supporter allocations
      for (const alloc of supporterAllocations) {
        if (alloc.points <= 0) continue;
        const e = this.kpiAllocRepo.create({
          taskId: taskIdNum,
          userId: alloc.userId,
          phase,
          points: alloc.points,
          is_main: false,
        } as any);
        savedAllocs.push(await this.kpiAllocRepo.save(e) as unknown as TaskKpiAllocation);
      }

      // Main gets remaining points
      if (main && mainPoints > 0) {
        const e = this.kpiAllocRepo.create({
          taskId: taskIdNum,
          userId: main.userId,
          phase,
          points: mainPoints,
          is_main: true,
        } as any);
        savedAllocs.push(await this.kpiAllocRepo.save(e) as unknown as TaskKpiAllocation);
      }

      if (savedAllocs.length > 0) {
        await this.writeKpiRecords(taskIdNum, phase, savedAllocs, productTypeId);
      }

      return { phase, totalPoints, mainPoints, supporterAllocs: supporterAllocations };
    } catch (err) {
      this.logger.error(`[KPI] allocateKpi failed: ${(err as any).message}`, (err as any).stack);
      throw err;
    }
  }

  private async fireTaskCompletedNotif(task: Task) {
    try {
      const assignees = await this.assigneeRepository.find({ where: { taskId: Number(task.id) } } as any);
      const main = assignees.find((a: any) => a.is_main);
      const mainName = main ? await this.employeeRepository.findOne({ where: { userId: main.userId } } as any) : null;
      const employeeName = (mainName as any)?.full_name || 'Unknown';
      const projectId = task.project_id;
      const project = await this.taskRepository.manager.connection.query(
        'SELECT name FROM projects WHERE id = $1', [projectId],
      );
      const projectName = project[0]?.name || `Project #${projectId}`;

      await this.notificationTriggers.taskCompleted(
        task.title || `Task #${task.id}`,
        projectName,
        employeeName,
      );
    } catch (err) {
      this.logger.error(`[NOTIF] fireTaskCompletedNotif error: ${(err as any).message}`);
    }
  }

  private async fireNewTaskAssignedNotif(taskId: number, userId: number) {
    try {
      const task = await this.taskRepository.findOne({ where: { id: taskId } } as any);
      if (!task) return;
      const project = await this.taskRepository.manager.connection.query(
        'SELECT name FROM projects WHERE id = $1', [task.project_id],
      );
      const projectName = project[0]?.name || `Project #${task.project_id}`;
      const emp = await this.employeeRepository.findOne({ where: { userId } } as any);
      const email = await this.taskRepository.manager.connection.query(
        'SELECT email FROM users WHERE id = $1', [userId],
      );
      await this.notificationTriggers.newTaskAssigned(
        task.title || `Task #${task.id}`,
        projectName,
        task.due_date ? new Date(task.due_date).toLocaleDateString('vi-VN') : 'Không có',
        task.priority || 'Trung bình',
        userId,
        email[0]?.email || undefined,
      );
    } catch (err) {
      this.logger.error(`[NOTIF] fireNewTaskAssignedNotif error: ${(err as any).message}`);
    }
  }

  private async fireRevisionRequestedNotif(taskId: string, reason: string) {
    try {
      const task = await this.getTask(taskId);
      const assignees = await this.assigneeRepository.find({ where: { taskId: Number(taskId) } } as any);
      for (const a of assignees) {
        const emp = await this.employeeRepository.findOne({ where: { userId: a.userId } } as any);
        const email = await this.taskRepository.manager.connection.query(
          'SELECT email FROM users WHERE id = $1', [a.userId],
        );
        await this.notificationTriggers.taskRevisionRequested(
          task.title || `Task #${task.id}`,
          'Admin',
          a.userId,
          email[0]?.email || undefined,
        );
      }
    } catch (err) {
      this.logger.error(`[NOTIF] fireRevisionRequestedNotif error: ${(err as any).message}`);
    }
  }

  private async writeKpiRecords(
    taskId: number,
    phase: string,
    allocations: TaskKpiAllocation[],
    productTypeId: number,
  ) {
    const dataSource = this.taskRepository.manager.connection;
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    const userIds = new Set<number>();

    for (const alloc of allocations) {
      await dataSource.query(
        `INSERT INTO employee_kpis (user_id, task_id, product_type_id, phase, points, achieved_date)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          alloc.userId,
          taskId,
          productTypeId || 1,
          phase,
          alloc.points,
          new Date().toISOString().split('T')[0],
        ],
      );
      userIds.add(alloc.userId);
    }

    for (const uid of userIds) {
      await this.kpiService.updateMonthlySummary(uid, year, month).catch((err) =>
        this.logger.error(`[KPI] Failed to update summary for user ${uid}: ${err.message}`),
      );
    }
  }

  async addAttachment(taskId: string, userId: number, url: string, name?: string) {
    const attachment = this.attachmentRepository.create({
      taskId: Number(taskId),
      userId,
      file_url: url,
      file_name: name || url.split('/').pop() || 'link',
      file_type: 'link',
    } as any);
    const saved = await this.attachmentRepository.save(attachment);

    const fullTask = await this.getTask(taskId);
    this.realtimeService.emitTaskEvent(String(fullTask.project_id), 'updated', fullTask);

    return saved;
  }

  async removeAttachment(attachId: number) {
    await this.attachmentRepository.delete(attachId);
    return { success: true };
  }

  async getTaskKpi(taskId: string) {
    const taskIdNum = Number(taskId);
    const task = await this.getTask(taskId);
    const allocs = await this.kpiAllocRepo.find({ where: { taskId: taskIdNum } as any });

    return {
      storyPoints: task.story_points,
      createdBy: task.created_by,
      phase: 'final',
      allocations: allocs,
      totalAllocated: allocs.reduce((s, a) => s + Number(a.points), 0),
    };
  }

  async approveV1(taskId: string) {
    const task = await this.getTask(taskId);
    task.status = 'v1';
    const updated = (await this.taskRepository.save(task)) as unknown as Task;

    this.realtimeService.emitTaskEvent(String(task.project_id), 'updated', {
      id: updated.id,
      title: updated.title,
      status: updated.status,
      project_id: updated.project_id,
      updatedAt: updated.updatedAt,
    });

    return updated;
  }

  async getEmployees() {
    return this.employeeRepository.find({});
  }

  async getAllTasks() {
    const tasks = await this.taskRepository.find({
      order: { createdAt: 'DESC' } as any,
    });

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
              is_main: a.is_main,
            };
          }),
        );
        let categoryName: string | undefined;
        if (task.category_id) {
          const cat = await this.categoryRepository.findOne({ where: { id: task.category_id } as any });
          categoryName = cat?.tittle;
        }
        return { ...task, assignees: assigneeInfos, category: categoryName ? { tittle: categoryName } : undefined };
      }),
    );

    return tasksWithAssignees;
  }

  async createCategory(ctg: CreateCategoryDto) {
    return await this.categoryRepository.save(ctg as any);
  }

  async getCategory() {
    return this.categoryRepository.find({});
  }
}






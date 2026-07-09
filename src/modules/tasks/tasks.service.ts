import { Injectable, Logger, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Task } from './entities/task.entity';
import { TaskAssignee } from './entities/task-assignee.entity';
import { TaskKpiAllocation } from './entities/task-kpi-allocation.entity';
import { TaskAttachment } from './entities/task-attachment.entity';
import { RealtimeService } from '@/modules/realtime/realtime.service';
import { TaskLogsService } from '@/modules/task-logs/task-logs.service';
import { CreateCategoryDto } from './dto/create_category.dto';
import { Task_Categories } from './entities/categories.entity';
import { Employee } from '@/modules/employee/entities/emplyee.entity';
import { User } from '@/modules/users/entities/user.entity';
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
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @InjectRepository(TaskPhaseApproval)
    private phaseApprovalRepo: Repository<TaskPhaseApproval>,
    private realtimeService: RealtimeService,
    private taskLogsService: TaskLogsService,
    private kpiService: KpiService,
    private notificationTriggers: NotificationTriggersService,
  ) {}

  private readonly PHASE_ORDER = ['todo', 'wip', 'review', 'v1', 'v2', 'done'];

  // Cache employee map for 30s to avoid repeated employee queries
  private employeeMapCache: Map<number, { full_name: string; avatar_url: string }> | null = null;
  private employeeMapCacheAt = 0;
  private async getEmployeeMap(): Promise<Map<number, { full_name: string; avatar_url: string }>> {
    if (this.employeeMapCache && Date.now() - this.employeeMapCacheAt < 30_000) {
      return this.employeeMapCache;
    }
    const emps = await this.employeeRepository.find();
    const map = new Map<number, { full_name: string; avatar_url: string }>();
    for (const e of emps) {
      map.set(e.userId, { full_name: e.full_name || 'Unknown', avatar_url: e.avatar_url || '' });
    }
    this.employeeMapCache = map;
    this.employeeMapCacheAt = Date.now();
    return map;
  }

  // Cache email map for 30s
  private emailMapCache: Map<number, string> | null = null;
  private emailMapCacheAt = 0;
  private async getEmailMap(): Promise<Map<number, string>> {
    if (this.emailMapCache && Date.now() - this.emailMapCacheAt < 30_000) {
      return this.emailMapCache;
    }
    const users = await this.userRepo.find({ select: ['id', 'email'] as any });
    const map = new Map<number, string>();
    for (const u of users) {
      map.set(u.id, (u as any).email || '');
    }
    this.emailMapCache = map;
    this.emailMapCacheAt = Date.now();
    return map;
  }

  // Helper: batch-load assignee info from employee map
  private async enrichAssignees(assignees: any[], empMap: Map<number, { full_name: string; avatar_url: string }>) {
    return assignees.map((a) => ({
      userId: a.userId,
      full_name: empMap.get(a.userId)?.full_name || 'Unknown',
      avatar_url: empMap.get(a.userId)?.avatar_url || '',
      assignedAt: a.assignedAt,
      is_main: a.is_main,
    }));
  }

  async requestPhase(taskId: string, userId: number, targetPhase?: string) {
    const task = await this.getTask(taskId);
    const nextPhase = targetPhase || (() => {
      const idx = this.PHASE_ORDER.indexOf(task.status);
      if (idx < 0 || idx >= this.PHASE_ORDER.length - 1) {
        throw new BadRequestException('Không thể chuyển phase từ trạng thái hiện tại');
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
      'Task không có yêu cầu duyệt',
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
      'Không tìm thấy yêu cầu duyệt',
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
      throw new BadRequestException('Không thể yêu cầu sửa ở trạng thái này');
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

    this.fireRevisionRequestedNotif(taskId, reason).catch(e => this.logger.error(`[NOTIF] ${e.message}`));

    return { task: fullTask, reason };
  }

  async revisionCompleted(taskId: string) {
    const task = await this.getTask(taskId);
    if (!task.revision_requested) {
      throw new BadRequestException('Task không có yêu cầu sửa nào');
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
      'Nhân viên',
      [{ field: 'revision', oldValue: 'requested', newValue: 'completed' }],
    );

    const fullTask = await this.getTask(taskId);
    this.realtimeService.emitTaskEvent(String(task.project_id), 'updated', fullTask);

    return { task: fullTask, message: 'Đã hoàn thành sửa, chờ admin duyệt' };
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

  // Optimized: preload all employees once into map
  async getTask(taskId: string) {
    const taskIdNum = parseInt(taskId, 10);

    const task = await this.taskRepository.findOne({
      where: { id: taskIdNum } as any,
      relations: { category: true, project: true } as any,
    });

    if (!task) {
      throw new NotFoundException(`Task ${taskId} not found`);
    }

    const [assignees, attachments, empMap] = await Promise.all([
      this.assigneeRepository.find({ where: { taskId: taskIdNum } as any }),
      this.attachmentRepository.find({ where: { taskId: taskIdNum } as any }),
      this.getEmployeeMap(),
    ]);

    const assigneeInfos = assignees.map((a) => ({
      userId: a.userId,
      full_name: empMap.get(a.userId)?.full_name || 'Unknown',
      avatar_url: empMap.get(a.userId)?.avatar_url || '',
      assignedAt: (a as any).assignedAt,
      is_main: a.is_main,
    }));

    return { ...task, assignees: assigneeInfos, attachments };
  }

  // Optimized: batch-load all assignees + attachments + employees in 3 queries instead of N+1
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

    if (tasks.length === 0) return [];

    const taskIds = tasks.map(t => t.id);
    const [allAssignees, allAttachments, empMap] = await Promise.all([
      this.assigneeRepository.find({ where: { taskId: In(taskIds) } as any }),
      this.attachmentRepository.find({ where: { taskId: In(taskIds) } as any }),
      this.getEmployeeMap(),
    ]);

    // Group assignees by taskId
    const assigneeGroup = new Map<number, any[]>();
    for (const a of allAssignees) {
      if (!assigneeGroup.has(a.taskId)) assigneeGroup.set(a.taskId, []);
      const emp = empMap.get(a.userId);
      assigneeGroup.get(a.taskId)!.push({
        userId: a.userId,
        full_name: emp?.full_name || 'Unknown',
        avatar_url: emp?.avatar_url || '',
        is_main: a.is_main,
      });
    }

    // Group attachments by taskId
    const attachmentGroup = new Map<number, any[]>();
    for (const att of allAttachments) {
      if (!attachmentGroup.has(att.taskId)) attachmentGroup.set(att.taskId, []);
      attachmentGroup.get(att.taskId)!.push(att);
    }

    return tasks.map((task) => ({
      ...task,
      assignees: assigneeGroup.get(task.id) ?? [],
      attachments: attachmentGroup.get(task.id) ?? [],
    }));
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

      const cleanDto = Object.fromEntries(
        Object.entries(updateTaskDto).filter(([_, v]) => v !== undefined && v !== null),
      );

      if (Object.keys(cleanDto).length > 0) {
        await this.taskRepository.update(
          { id: Number(taskId) },
          cleanDto as any,
        );
      }

      if ('story_points' in cleanDto && oldValues['story_points'] !== cleanDto['story_points']) {
        this.logger.log(`[TASK] Recalculating KPI for task ${taskId} due to story point change.`);
        await this.recalculateAllKpi(Number(taskId));
      }

      if (cleanDto['priority'] === 'urgent' && oldValues['priority'] !== 'urgent') {
        this.logger.log(`[TASK] Priority for task ${taskId} changed to 'urgent'. Firing notification.`);
        this.fireTaskBecameUrgentNotif(task).catch(e => this.logger.error(`[NOTIF] fireTaskBecameUrgentNotif failed: ${e.message}`));
      }

      await this.taskLogsService.createLog(
        resolvedProjectId,
        taskId,
        'updated',
        userId || 'system',
        userName || 'System',
        Object.keys(cleanDto).map(key => ({
          field: key,
          oldValue: oldValues[key],
          newValue: cleanDto[key],
        })),
      );

      const fullTask = await this.getTask(taskId);
      this.realtimeService.emitTaskEvent(resolvedProjectId, 'updated', fullTask);

      this.logger.log(
        `[TASK] Updated: ${taskId} in project ${resolvedProjectId}`,
      );
      return fullTask;
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

  // Optimized: batch save kpi allocations
  async allocateKpi(
    taskId: string,
    supporterAllocations: { userId: number; points: number }[],
  ) {
    try {
      const taskIdNum = Number(taskId);
      const phase = 'final';
      const task = await this.getTask(taskId);
      const totalPoints = Number(task.story_points) || 0;

      const ptRows = await this.taskRepository.manager.connection.query(
        `SELECT id FROM kpi_product_types ORDER BY id LIMIT 1`,
      );
      const productTypeId = ptRows.length > 0 ? Number(ptRows[0].id) : 1;

      const supporterSum = supporterAllocations.reduce((s, a) => s + a.points, 0);
      if (supporterSum > totalPoints) {
        throw new BadRequestException(`Điểm hỗ trợ (${supporterSum}) vượt quá tổng điểm task (${totalPoints})`);
      }

      const assignees = await this.assigneeRepository.find({ where: { taskId: taskIdNum } } as any);
      const main = assignees.find((a: any) => a.is_main);
      const mainPoints = Math.round((totalPoints - supporterSum) * 100) / 100;

      await this.taskRepository.manager.connection.query(
        `DELETE FROM task_kpi_allocation WHERE "taskId" = $1 AND phase = $2`,
        [taskIdNum, phase],
      );
      await this.taskRepository.manager.connection.query(
        `DELETE FROM employee_kpis WHERE task_id = $1 AND phase = $2`,
        [taskIdNum, phase],
      );

      // Batch create all allocation entities
      const allocEntities: TaskKpiAllocation[] = [];

      for (const alloc of supporterAllocations) {
        if (alloc.points <= 0) continue;
        allocEntities.push(this.kpiAllocRepo.create({
          taskId: taskIdNum,
          userId: alloc.userId,
          phase,
          points: alloc.points,
          is_main: false,
        } as any) as unknown as TaskKpiAllocation);
      }

      if (main && mainPoints > 0) {
        allocEntities.push(this.kpiAllocRepo.create({
          taskId: taskIdNum,
          userId: main.userId,
          phase,
          points: mainPoints,
          is_main: true,
        } as any) as unknown as TaskKpiAllocation);
      }

      // Batch save all at once
      const savedAllocs = await this.kpiAllocRepo.save(allocEntities);

      if (savedAllocs.length > 0) {
        await this.writeKpiRecords(taskIdNum, phase, savedAllocs as unknown as TaskKpiAllocation[], productTypeId);
      }

      return { phase, totalPoints, mainPoints, supporterAllocs: supporterAllocations };
    } catch (err) {
      this.logger.error(`[KPI] allocateKpi failed: ${(err as any).message}`, (err as any).stack);
      throw err;
    }
  }

  // Optimized: batch-load employee + project in one shot
  private async fireTaskCompletedNotif(task: Task) {
    try {
      const [empMap, project] = await Promise.all([
        this.getEmployeeMap(),
        this.taskRepository.manager.connection.query(
          'SELECT "projectName" FROM projects WHERE id = $1', [task.project_id],
        ),
      ]);
      const projectName = project[0]?.projectName || `Project #${task.project_id}`;
      const assignees = await this.assigneeRepository.find({ where: { taskId: Number(task.id) } } as any);
      const main = assignees.find((a: any) => a.is_main);
      const employeeName = main ? (empMap.get(main.userId)?.full_name || 'Unknown') : 'Unknown';

      await this.notificationTriggers.taskCompleted(
        task.title || `Task #${task.id}`,
        projectName,
        employeeName,
      );
    } catch (err) {
      this.logger.error(`[NOTIF] fireTaskCompletedNotif error: ${(err as any).message}`);
    }
  }

  // Optimized: batch-load employee + email from cache
  private async fireNewTaskAssignedNotif(taskId: number, userId: number) {
    try {
      const [task, empMap, emailMap] = await Promise.all([
        this.taskRepository.findOne({ where: { id: taskId } } as any),
        this.getEmployeeMap(),
        this.getEmailMap(),
      ]);
      if (!task) return;

      const project = await this.taskRepository.manager.connection.query(
        'SELECT "projectName" FROM projects WHERE id = $1', [task.project_id],
      );
      const projectName = project[0]?.projectName || `Project #${task.project_id}`;

      await this.notificationTriggers.newTaskAssigned(
        task.title || `Task #${task.id}`,
        projectName,
        task.due_date ? new Date(task.due_date).toLocaleDateString('vi-VN') : 'Không có',
        task.priority || 'Trung bình',
        userId,
        emailMap.get(userId) || undefined,
      );
    } catch (err) {
      this.logger.error(`[NOTIF] fireNewTaskAssignedNotif error: ${(err as any).message}`);
    }
  }

  // Optimized: batch-load employee + email info before loop
  private async fireRevisionRequestedNotif(taskId: string, reason: string) {
    try {
      const [task, empMap, emailMap] = await Promise.all([
        this.getTask(taskId),
        this.getEmployeeMap(),
        this.getEmailMap(),
      ]);
      const assignees = await this.assigneeRepository.find({ where: { taskId: Number(taskId) } } as any);

      // Fire notifications concurrently
      await Promise.all(assignees.map(async (a: any) => {
        await this.notificationTriggers.taskRevisionRequested(
          task.title || `Task #${task.id}`,
          'Admin',
          reason,
          a.userId,
          emailMap.get(a.userId) || undefined,
        );
      }));
    } catch (err) {
      this.logger.error(`[NOTIF] fireRevisionRequestedNotif error: ${(err as any).message}`);
    }
  }

  // Optimized: batch INSERT instead of N inserts
  private async writeKpiRecords(
    taskId: number,
    phase: string,
    allocations: TaskKpiAllocation[],
    productTypeId: number,
  ) {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const achievedDate = now.toISOString().split('T')[0];

    const userIds = new Set<number>();

    if (allocations.length > 0) {
      // Build batch INSERT with multiple value tuples
      const values = allocations.map((alloc) => {
        userIds.add(alloc.userId);
        return `(${alloc.userId}, ${taskId}, ${productTypeId || 1}, '${phase}', ${alloc.points}, '${achievedDate}')`;
      });

      await this.taskRepository.manager.connection.query(
        `INSERT INTO employee_kpis (user_id, task_id, product_type_id, phase, points, achieved_date) VALUES ${values.join(', ')}`
      );
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

  // Optimized: batch-load all assignees + employees + categories in 3 queries instead of N+1
  async getAllTasks() {
    const tasks = await this.taskRepository.find({
      order: { createdAt: 'DESC' } as any,
    });

    if (tasks.length === 0) return [];

    const taskIds = tasks.map(t => t.id);
    const categoryIds = tasks.filter(t => t.category_id).map(t => t.category_id);

    const [allAssignees, empMap, categories] = await Promise.all([
      this.assigneeRepository.find({ where: { taskId: In(taskIds) } as any }),
      this.getEmployeeMap(),
      categoryIds.length > 0
        ? this.categoryRepository.find({ where: { id: In(categoryIds) } as any })
        : Promise.resolve([]),
    ]);

    const categoryMap = new Map<number, any>();
    for (const cat of categories) {
      categoryMap.set(cat.id, cat);
    }

    // Group assignees by taskId
    const assigneeGroup = new Map<number, any[]>();
    for (const a of allAssignees) {
      if (!assigneeGroup.has(a.taskId)) assigneeGroup.set(a.taskId, []);
      const emp = empMap.get(a.userId);
      assigneeGroup.get(a.taskId)!.push({
        userId: a.userId,
        full_name: emp?.full_name || 'Unknown',
        avatar_url: emp?.avatar_url || '',
        is_main: a.is_main,
      });
    }

    return tasks.map((task) => {
      const cat = task.category_id ? categoryMap.get(task.category_id) : undefined;
      return {
        ...task,
        assignees: assigneeGroup.get(task.id) ?? [],
        category: cat ? { tittle: cat.tittle } : undefined,
      };
    });
  }

  async createCategory(ctg: CreateCategoryDto) {
    return await this.categoryRepository.save(ctg as any);
  }

  async getCategory() {
    return this.categoryRepository.find({});
  }

  // Optimized: batch-load user info before loop
  private async fireTaskBecameUrgentNotif(task: Task) {
    try {
      const [assignees, project, emailMap, empMap] = await Promise.all([
        this.assigneeRepository.find({ where: { taskId: Number(task.id) } } as any),
        this.taskRepository.manager.connection.query(
          'SELECT "projectName" FROM projects WHERE id = $1', [task.project_id],
        ),
        this.getEmailMap(),
        this.getEmployeeMap(),
      ]);
      const projectName = project[0]?.projectName || `Project #${task.project_id}`;

      await Promise.all(assignees.map(async (assignee: any) => {
        const email = emailMap.get(assignee.userId);
        if (email) {
          await this.notificationTriggers.taskBecameUrgent(
            task.title || `Task #${task.id}`,
            projectName,
            assignee.userId,
            email,
          );
        }
      }));
    } catch (err) {
      this.logger.error(`[NOTIF] fireTaskBecameUrgentNotif error: ${(err as any).message}`);
    }
  }
}

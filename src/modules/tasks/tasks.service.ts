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

@Injectable()
export class TasksService {
  private logger = new Logger('TasksService');

  private readonly PHASE_POOLS: Record<string, number> = {
    v1: 0.4,
    v2: 0.3,
    v3: 0.3,
  };

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
  ) {}


  private readonly PHASE_ORDER = ['todo', 'wip', 'review', 'v1', 'v2', 'v3', 'done'];

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
    // Delete all existing KPI allocations for this task
    await this.kpiAllocRepo.delete({ taskId } as any);
    await this.taskRepository.manager.connection.query(
      `DELETE FROM employee_kpis WHERE task_id = $1`,
      [taskId],
    );
  }

  private async autoAllocateKpiOnApproval(task: Task, newStatus: string, oldStatus: string) {
    const vPhases = ['v1', 'v2', 'v3'];
    const storyPoints = Number(task.story_points) || 0;
    if (storyPoints <= 0) return;

    // Determine which phases to allocate
    const phasesToAllocate: string[] = [];

    if (newStatus === 'done') {
      // Skipped from review or earlier → allocate all v1+v2+v3
      if (oldStatus === 'review' || oldStatus === 'wip' || oldStatus === 'todo') {
        phasesToAllocate.push('v1', 'v2', 'v3');
      } else if (oldStatus === 'v1') {
        phasesToAllocate.push('v1', 'v2', 'v3');
      } else if (oldStatus === 'v2') {
        phasesToAllocate.push('v2', 'v3');
      } else if (oldStatus === 'v3') {
        phasesToAllocate.push('v3');
      }
    } else if (vPhases.includes(newStatus)) {
      // Approved a specific v-phase
      phasesToAllocate.push(newStatus);
    }

    if (phasesToAllocate.length === 0) return;

    const taskIdNum = task.id;
    const assignees = await this.assigneeRepository.find({ where: { taskId: taskIdNum } as any });
    if (assignees.length === 0) return;

    const mainAssignee = assignees.find((a) => a.is_main);

    for (const phase of phasesToAllocate) {
      const poolRatio = this.PHASE_POOLS[phase] || 0;
      const poolMax = Math.round(storyPoints * poolRatio * 100) / 100;

      // Check if already allocated for this phase
      const existingAllocs = await this.kpiAllocRepo.find({ where: { taskId: taskIdNum, phase } as any });
      if (existingAllocs.length > 0) continue; // already allocated (e.g. via manual UI), skip

      const savedAllocs: TaskKpiAllocation[] = [];

      // Give the pool to main assignee (admin can later re-allocate via UI)
      if (mainAssignee) {
        const mainAlloc = this.kpiAllocRepo.create({
          taskId: taskIdNum,
          userId: mainAssignee.userId,
          phase,
          points: poolMax,
          is_main: true,
        } as any);
        savedAllocs.push(await this.kpiAllocRepo.save(mainAlloc) as unknown as TaskKpiAllocation);
      }

      if (savedAllocs.length > 0) {
        await this.writeKpiRecords(taskIdNum, phase, savedAllocs, task.category_id);
      }
    }
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

  // Auto-allocate KPI when approving a V1/V2/V3 phase or skipping to done
  await this.autoAllocateKpiOnApproval(task, task.status, oldStatus);

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

  async getTask(taskId: string) {
    const taskIdNum = parseInt(taskId, 10);

    const task = await this.taskRepository.findOne({
      where: { id: taskIdNum } as any,
      relations: { category: true, project: true } as any,
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
          is_main: a.is_main,
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
      relations: { category: true, project: true } as any,
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

      Object.assign(task, updateTaskDto);
      // Clear relation object so TypeORM uses FK column value
      if ('category_id' in updateTaskDto) (task as any).category = null;
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

      // If story_points changed, recalculate all KPI allocations for this task
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

      // Auto-allocate KPI if moving into a v-phase or done
      await this.autoAllocateKpiOnApproval(task, newStatus, oldStatus);

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

  // Assign member to task (supports isMain)
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

  // ── KPI Allocation ──

  async getPhaseKpiInfo(taskId: string, phase: string) {
    const task = await this.getTask(taskId);
    const totalPoints = Number(task.story_points) || 0;
    const poolRatio = this.PHASE_POOLS[phase] || 0;
    const poolMax = Math.round(totalPoints * poolRatio * 100) / 100;

    const existingAllocs = await this.kpiAllocRepo.find({ where: { taskId: Number(taskId), phase } as any });
    const allocatedAll = existingAllocs.reduce((s, a) => s + Number(a.points), 0);

    return {
      totalPoints,
      phase,
      poolRatio,
      poolMax,
      allocated: Math.round(allocatedAll * 100) / 100,
      remaining: Math.round((poolMax - allocatedAll) * 100) / 100,
      allocations: existingAllocs,
    };
  }

  async allocatePhaseKpi(
    taskId: string,
    phase: string,
    allocations: { userId: number; points: number }[],
  ) {
    const task = await this.getTask(taskId);
    const taskIdNum = Number(taskId);
    const totalPoints = Number(task.story_points) || 0;
    const poolRatio = this.PHASE_POOLS[phase] || 0;
    const poolMax = Math.round(totalPoints * poolRatio * 100) / 100;

    // Delete old allocations for this phase first (re-allocate)
    const oldAllocs = await this.kpiAllocRepo.find({ where: { taskId: taskIdNum, phase } as any });
    if (oldAllocs.length > 0) {
      await this.kpiAllocRepo.delete({ taskId: taskIdNum, phase } as any);
      // Also clean employee_kpis
      await this.taskRepository.manager.connection.query(
        `DELETE FROM employee_kpis WHERE task_id = $1 AND phase = $2`,
        [taskIdNum, phase],
      );
    }

    // Find main assignee
    const assignees = await this.assigneeRepository.find({ where: { taskId: taskIdNum } as any });
    const mainAssignee = assignees.find((a) => a.is_main);
    const supportAssignees = assignees.filter((a) => !a.is_main);

    if (!mainAssignee && supportAssignees.length === 0) return { phase, poolMax, allocated: { main: 0, supporters: [] }, savedAllocs: [] };

    // Build allocation: main gets pool - supporters, supporters get their requested amounts
    const mainPoints = mainAssignee
      ? Math.round((poolMax - allocations.reduce((s, a) => s + a.points, 0)) * 100) / 100
      : 0;

    const savedAllocs: TaskKpiAllocation[] = [];

    if (mainAssignee && mainPoints > 0) {
      const mainAlloc = this.kpiAllocRepo.create({
        taskId: taskIdNum,
        userId: mainAssignee.userId,
        phase,
        points: mainPoints,
        is_main: true,
      } as any);
      savedAllocs.push(await this.kpiAllocRepo.save(mainAlloc) as unknown as TaskKpiAllocation);
    }

    for (const alloc of allocations) {
      if (alloc.points <= 0) continue;
      const suppAlloc = this.kpiAllocRepo.create({
        taskId: taskIdNum,
        userId: alloc.userId,
        phase,
        points: alloc.points,
        is_main: false,
      } as any);
      savedAllocs.push(await this.kpiAllocRepo.save(suppAlloc) as unknown as TaskKpiAllocation);
    }

    if (savedAllocs.length > 0) {
      await this.writeKpiRecords(taskIdNum, phase, savedAllocs, task.category_id);
    }

    return { phase, poolMax, allocated: { main: mainPoints, supporters: allocations }, savedAllocs };
  }

  private async writeKpiRecords(
    taskId: number,
    phase: string,
    allocations: TaskKpiAllocation[],
    productTypeId: number,
  ) {
    const dataSource = this.taskRepository.manager.connection;

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

    const byPhase: Record<string, any> = {};
    for (const a of allocs) {
      if (!byPhase[a.phase]) {
        const info = await this.getPhaseKpiInfo(taskId, a.phase);
        byPhase[a.phase] = { ...info, entries: [] };
      }
      byPhase[a.phase].entries.push(a);
    }

    return {
      storyPoints: task.story_points,
      createdBy: task.created_by,
      phases: byPhase,
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

  // Get all employees for assign dropdown
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

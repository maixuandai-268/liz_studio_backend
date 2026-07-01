import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TaskChecklist } from '../entities/task-checklist.entity';

@Injectable()
export class TasksChecklistsService {
  constructor(
    @InjectRepository(TaskChecklist)
    private checklistRepo: Repository<TaskChecklist>,
  ) {}

  async findAll(taskId: number) {
    return this.checklistRepo.find({
      where: { taskId } as any,
      order: { createdAt: 'ASC' },
    });
  }

  async create(taskId: number, content: string) {
    const item = this.checklistRepo.create({
      taskId,
      content,
      isCompleted: false,
    } as any);
    return this.checklistRepo.save(item);
  }

  async toggle(id: number) {
    const item = await this.checklistRepo.findOne({ where: { id } } as any);
    if (!item) throw new Error('Checklist item not found');
    item.isCompleted = !item.isCompleted;
    return this.checklistRepo.save(item);
  }

  async remove(id: number) {
    return this.checklistRepo.delete(id);
  }
}


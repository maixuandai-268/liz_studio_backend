import { CreateProjectDto } from './dto/create-project.dto';
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable prettier/prettier */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable, ConflictException, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Projects } from './entities/project.entity';
import { UpdateProjectDto } from './dto/update-project.dto';
import { Task_Categories } from '../tasks/entities/categories.entity';
import { Task } from '../tasks/entities/task.entity';
import { ChatService } from '@/modules/chat/chat.service';
import { NotificationTriggersService } from '@/modules/notifications/notification-triggers.service';

@Injectable()
export class ProjectService {
  constructor(
    @InjectRepository(Projects)
    private readonly projectRepo: Repository<Projects>,
    @InjectRepository(Task_Categories)
    private readonly categoriesRepo: Repository<Task_Categories>,
    @InjectRepository(Task)
    private readonly taskRepo: Repository<Task>,
    private chatService: ChatService,
    private notificationTriggers: NotificationTriggersService,
  ) { }

  async findOne(id: number) {
    const project = await this.projectRepo.findOneBy({ id });
    if (!project) {
      throw new BadRequestException(`Không tìm thấy Project với id ${id}`);
    }

    return project;
  }

  
  async createProject(dto: CreateProjectDto , id : number) {
    const userCreateId = id
    const project = await this.projectRepo.save(
  this.projectRepo.create({
    projectName: dto.projectName,
    year: dto.year,
    backgroundImage: dto.backgroundImage,
    clientName: dto.clientName,
    locationName: dto.locationName,
    images : dto.images,
    description: dto.description,
    start_date : dto.start_date,
    due_date : dto.due_date
  }),
);

for (const view of dto.views) {
  const category = await this.categoriesRepo.findOne({
    where: { id: view.categoryId },
  });

  if (!category) continue;

  const tasks = Array.from(
    { length: view.count },
    (_, i) =>
      this.taskRepo.create({
        project,
        category,
      }),
  );

  await this.taskRepo.save(tasks);
}

  try {
    await this.chatService.createGroupRoom(
      dto.projectName,
      userCreateId,
      [userCreateId],
      project.id,
    );
  } catch (e) {
    console.error('Failed to auto-create chat room:', e);
  }

  return project;
}

  async findAll() {
    return await this.projectRepo.find({ order: { createdAt: 'DESC' } });
  }

  async update(id: number, updateProjectDto: UpdateProjectDto) {
    const project = await this.projectRepo.findOneBy({ id });
    if (!project) {
      throw new BadRequestException(`Không tìm thấy Project với id ${id}`);
    }

    const oldStatus = project.status;
    Object.assign(project, updateProjectDto);
    const saved = await this.projectRepo.save(project);

    if (oldStatus !== 'completed' && updateProjectDto.status === 'completed') {
      this.notificationTriggers.projectCompleted((project as any).projectName || `Project #${project.id}`).catch(() => undefined);
    }

    return saved;
  }

  async remove(id: number) {
    const project = await this.projectRepo.findOneBy({ id });
    if (!project) {
      throw new BadRequestException(`Không tìm thấy Project với id ${id}`);
    }
    return await this.projectRepo.remove(project);
  }

  
}


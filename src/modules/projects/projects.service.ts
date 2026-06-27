import { CreateProjectDto } from './dto/create-project.dto';
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable prettier/prettier */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable, ConflictException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Projects } from './entities/project.entity';
import { UpdateProjectDto } from './dto/update-project.dto';
import { Task_Categories } from '../tasks/entities/categories.entity';
import { Task } from '../tasks/entities/task.entity';

@Injectable()
export class ProjectService {
  constructor(
    @InjectRepository(Projects)
    private readonly projectRepo: Repository<Projects>,
    @InjectRepository(Task_Categories)
    private readonly categoriesRepo: Repository<Task_Categories>,
    @InjectRepository(Task)
    private readonly taskRepo: Repository<Task>,
  ) { }

  async findOne(id: number) {
    const project = await this.projectRepo.findOneBy({ id });
    if (!project) {
      throw new BadRequestException(`Không tìm thấy Project với id ${id}`);
    }

    return project;
  }

  
  async createProject(dto: CreateProjectDto) {
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
}

  async findAll() {
    return await this.projectRepo.find({ order: { createdAt: 'DESC' } });
  }

  async update(id: number, updateProjectDto: UpdateProjectDto) {
    const project = await this.projectRepo.findOneBy({ id });
    if (!project) {
      throw new BadRequestException(`Không tìm thấy Project với id ${id}`);
    }

    Object.assign(project, updateProjectDto);
    return await this.projectRepo.save(project);
  }

  async remove(id: number) {
    const project = await this.projectRepo.findOneBy({ id });
    if (!project) {
      throw new BadRequestException(`Không tìm thấy Project với id ${id}`);
    }
    return await this.projectRepo.remove(project);
  }

  
}

/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable prettier/prettier */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable, ConflictException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Project } from './project.entity';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';

@Injectable()
export class ProjectService {
  constructor(
    @InjectRepository(Project)
    private readonly projectRepo: Repository<Project>,
  ) { }

  async findOne(id: number) {
    const project = await this.projectRepo.findOneBy({ id });
    if (!project) {
      throw new BadRequestException(`Không tìm thấy Project với id ${id}`);
    }

    return project;
  }

  async create(CreateProjectDto : CreateProjectDto) {
    const existingProject = await this.projectRepo.findOneBy({ projectName: CreateProjectDto.projectName });
    if (existingProject) {
      throw new ConflictException(`Đã tồn tại Project với tên ${CreateProjectDto.projectName}`);
    }
    const newProject = this.projectRepo.create(CreateProjectDto);
    return await this.projectRepo.save(newProject);
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


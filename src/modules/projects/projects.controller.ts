/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable prettier/prettier */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Controller, Get, Post, Param, Patch, Delete, Body, UsePipes, ValidationPipe, UseGuards, Req } from '@nestjs/common';
import { ProjectService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';

@Controller('projects')
@UseGuards(JwtAuthGuard)
export class ProjectController {
  constructor(private readonly projectService: ProjectService) { }


  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.projectService.findOne(+id);
  }


  @Post()
  @UsePipes(new ValidationPipe())
  create(@Body() createProjectDto: CreateProjectDto, @Req() req: any) {
    const userId = Number(req.user?.id || req.user?.sub);
    return this.projectService.createProject(createProjectDto, userId);
  }

  @Get()
  findAll() {
    return this.projectService.findAll();
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateProjectDto: UpdateProjectDto) {
    return this.projectService.update(+id, updateProjectDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.projectService.remove(+id);
  }
}
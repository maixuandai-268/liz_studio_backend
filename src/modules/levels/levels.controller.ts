import { Controller, Get, Post, Patch, Delete, Param, Body, UsePipes, ValidationPipe } from '@nestjs/common';
import { LevelsService } from './levels.service';
import { CreateLevelDto } from './dto/create-level.dto';
import { UpdateLevelDto } from './dto/update-level.dto';

@Controller('levels')
export class LevelsController {
  constructor(private readonly levelsService: LevelsService) {}

  @Get()
  findAll() {
    return this.levelsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.levelsService.findOne(+id);
  }

  @Post()
  @UsePipes(new ValidationPipe())
  create(@Body() dto: CreateLevelDto) {
    return this.levelsService.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateLevelDto) {
    return this.levelsService.update(+id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.levelsService.remove(+id);
  }
}


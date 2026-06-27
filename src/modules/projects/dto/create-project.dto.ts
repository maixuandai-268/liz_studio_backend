/* eslint-disable prettier/prettier */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import { IsString, IsNotEmpty, MinLength, IsOptional, IsNumber, IsArray, ValidateNested, IsDate } from 'class-validator';
import { ProjectViewDto } from './sub-project.dto';
import { Type } from 'class-transformer';

export class CreateProjectDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(5)
  projectName: string;

  @IsNumber()
  @IsOptional()
  year: number;

  @IsString()
  @IsNotEmpty()
  backgroundImage: string;

  @IsString()
  @IsNotEmpty()
  clientName: string;

  @IsString()
  @IsOptional()
  locationName: string;

  @IsString()
  @IsOptional()
  description: string;

  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  images?: string[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProjectViewDto)
  views: ProjectViewDto[];

  @IsDate()
  @Type(() => Date)
  @IsOptional()
  start_date: Date;

  @IsDate()
  @Type(() => Date)
  @IsOptional()
  due_date: Date;
}
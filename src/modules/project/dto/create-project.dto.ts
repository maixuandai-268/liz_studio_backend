/* eslint-disable prettier/prettier */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import { IsString, IsNotEmpty, MinLength, IsOptional, IsNumber, IsArray } from 'class-validator';

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
}


import { IsString, IsOptional, IsNumber, Min } from 'class-validator';

export class CreateLevelDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  kpi_target?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  kpi_salary?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  salary_coefficient?: number;
}

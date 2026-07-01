import { IsOptional, IsInt, IsString, IsDateString, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class AttendanceQueryDto {
  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  userId?: number;
}


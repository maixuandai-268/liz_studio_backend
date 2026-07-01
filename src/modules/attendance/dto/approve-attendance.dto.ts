import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ApproveAttendanceDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  status?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}


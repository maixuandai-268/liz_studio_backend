import { IsEnum, IsOptional } from 'class-validator';

export enum ProjectStatus {
  ACTIVE = 'active',
  REVIEW = 'review',
  COMPLETED = 'completed',
  CANCELED = 'canceled',
}

export class UpdateProjectDto {
  @IsOptional()
  @IsEnum(ProjectStatus)
  status?: ProjectStatus;
}
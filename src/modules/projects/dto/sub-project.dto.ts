import { IsInt, Min } from 'class-validator';

export class ProjectViewDto {
  @IsInt()
  categoryId: number;

  @IsInt()
  @Min(1)
  count: number;
}


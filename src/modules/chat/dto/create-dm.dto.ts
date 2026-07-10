import { IsInt, IsPositive } from 'class-validator';

export class CreateDmDto {
  @IsInt()
  @IsPositive()
  targetUserId: number;
}

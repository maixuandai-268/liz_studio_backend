/* eslint-disable prettier/prettier */
import { IsOptional, IsNumberString, IsString, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CursorQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;

  @IsOptional()
  @IsString()
  cursor?: string;
}

export class PaginatedResponseDto<T> {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
}

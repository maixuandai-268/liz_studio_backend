/* eslint-disable prettier/prettier */
import { IsOptional, IsNumberString, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class CursorQueryDto {
  @IsOptional()
  @IsNumberString()
  @Type(() => Number)
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

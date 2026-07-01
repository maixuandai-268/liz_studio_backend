import { IsString, IsOptional, IsBoolean } from 'class-validator';

export class UpdateChannelDto {
  @IsString()
  @IsOptional()
  description?: string;

  @IsBoolean()
  @IsOptional()
  isPublic?: boolean;

  @IsString()
  @IsOptional()
  restrictTo?: string;

  @IsString()
  @IsOptional()
  icon?: string;
}


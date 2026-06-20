import { IsString, IsNotEmpty, IsOptional, IsBoolean } from 'class-validator';

export class CreateChannelDto {
  @IsString()
  @IsNotEmpty({ message: 'name is required' })
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsBoolean()
  @IsOptional()
  isPublic?: boolean = true;

  @IsString()
  @IsOptional()
  restrictTo?: string = 'all';

  @IsString()
  @IsOptional()
  icon?: string;
}
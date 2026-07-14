import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class UpdateUserDto {
  @IsOptional()
  @IsEnum(['employee', 'admin'])
  role?: 'employee' | 'admin';

  @IsOptional()
  @IsString()
  employee_code?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  password?: string;

  @IsOptional()
  isActive?: boolean;
}


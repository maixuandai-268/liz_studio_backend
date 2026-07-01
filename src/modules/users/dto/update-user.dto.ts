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

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsOptional()
  isActive?: boolean;
}


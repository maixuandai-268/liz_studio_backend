import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @IsString()
  employee_code: string;

  @IsString()
  @MinLength(6)
  password: string;
}


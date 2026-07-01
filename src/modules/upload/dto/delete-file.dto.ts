/* eslint-disable prettier/prettier */
import { IsString, IsOptional, IsIn } from 'class-validator';

export class DeleteFileDto {
  @IsString()
  public_id: string;

  @IsOptional()
  @IsIn(['image'])
  resource_type?: 'image';
}


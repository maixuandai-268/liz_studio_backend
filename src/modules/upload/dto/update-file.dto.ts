/* eslint-disable prettier/prettier */
import { IsString, IsIn } from 'class-validator';

export class UpdateFileDto {
  @IsString()
  old_public_id: string;

  @IsIn(['image'])
  resource_type: 'image';
}
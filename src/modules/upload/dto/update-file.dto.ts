import { IsString, IsIn } from 'class-validator';

export class UpdateFileDto {
  @IsString()
  old_public_id: string;

  @IsIn(['image', 'raw'])
  resource_type: 'image' | 'raw';
}
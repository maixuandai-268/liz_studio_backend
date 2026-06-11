import { IsString, IsOptional, IsIn } from 'class-validator';

export class DeleteFileDto {
  @IsString()
  public_id: string;

  @IsOptional()
  @IsIn(['image', 'raw'])
  resource_type?: 'image' | 'raw';
}
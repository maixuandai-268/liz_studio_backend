import {
  IsString,
  IsNotEmpty,
  IsOptional,
  MinLength,
  MaxLength,
  IsEnum,
} from 'class-validator';

export enum MessageType {
  TEXT = 'TEXT',
  FILE = 'FILE',
  SYSTEM = 'SYSTEM',
}

export class CreateMessageDto {
  @IsString()
  @IsNotEmpty({ message: 'projectId is required' })
  projectId: string;

  @IsString()
  @IsNotEmpty({ message: 'content is required' })
  @MinLength(1, { message: 'content must not be empty' })
  @MaxLength(5000, { message: 'content must not exceed 5000 characters' })
  content: string;

  @IsEnum(MessageType)
  @IsOptional()
  type?: MessageType = MessageType.TEXT;

  @IsString()
  @IsOptional()
  metadata?: string;
}
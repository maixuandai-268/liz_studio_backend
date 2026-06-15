/* eslint-disable prettier/prettier */
import { IsEnum, IsNumber, IsOptional, IsNotEmpty, IsString } from 'class-validator';
import { NotificationType } from '../notification.entity';

export class CreateNotificationDto {
  @IsNumber()
  @IsNotEmpty()
  userId: number;

  @IsString()
  @IsNotEmpty()
  message: string;

  @IsEnum(NotificationType)
  @IsOptional()
  type?: NotificationType;
}

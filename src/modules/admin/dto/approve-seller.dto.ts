import {
  IsUUID,
  IsEnum,
  IsOptional,
  IsString,
  IsBoolean,
} from 'class-validator';

export class ApproveSellerDto {
  @IsUUID()
  sellerId: string;

  @IsEnum(['approved', 'rejected'])
  status: 'approved' | 'rejected';

  @IsOptional()
  @IsString()
  reason?: string;
}

export class UpdateUserStatusDto {
  @IsUUID()
  userId: string;

  @IsBoolean()
  is_active: boolean;
}

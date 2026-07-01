import { IsString, IsNumber, IsOptional, Min, Max } from 'class-validator';

export class CreateProductTypeDto {
  @IsString()
  name: string;

  @IsNumber()
  @Min(0)
  basePoints: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  v1Percent?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  v2Percent?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  fnPercent?: number;
}


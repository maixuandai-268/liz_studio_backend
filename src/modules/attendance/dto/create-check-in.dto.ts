import { IsOptional, IsString, MaxLength, IsNumber, Min, Max } from 'class-validator';

export class CreateCheckInDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude: number;
}

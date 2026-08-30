import { IsString, IsNotEmpty, IsOptional, IsDateString, IsEnum } from 'class-validator';

export class ReturnAssetDto {
  @IsEnum(['Good', 'Fair', 'Damaged'])
  @IsNotEmpty()
  condition: string;

  @IsOptional()
  @IsEnum(['Available', 'Maintenance', 'Retired'])
  destinationStatus?: 'Available' | 'Maintenance' | 'Retired';

  @IsOptional()
  @IsString()
  remarks?: string;

  @IsOptional()
  @IsDateString()
  returnDate?: string;
}

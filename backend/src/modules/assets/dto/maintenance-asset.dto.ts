import { IsString, IsOptional } from 'class-validator';

export class MaintenanceAssetDto {
  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsString()
  condition?: string;
}

export class RepairAssetDto {
  @IsOptional()
  @IsString()
  condition?: string; // e.g. "Good" or "New"

  @IsOptional()
  @IsString()
  remarks?: string;
}

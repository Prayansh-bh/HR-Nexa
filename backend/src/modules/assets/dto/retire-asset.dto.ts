import { IsString, IsOptional } from 'class-validator';

export class RetireAssetDto {
  @IsOptional()
  @IsString()
  reason?: string;
}

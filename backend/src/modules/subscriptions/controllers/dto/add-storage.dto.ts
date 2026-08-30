import { IsNumber, IsPositive, IsOptional, IsString } from 'class-validator';

export class AddStorageDto {
  @IsOptional()
  @IsNumber()
  @IsPositive()
  storageGB?: number;

  @IsOptional()
  @IsString()
  storage?: string;
}

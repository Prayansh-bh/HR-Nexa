import { IsOptional, IsNumber, IsString, Min } from 'class-validator';

export class ProcessRefundDto {
  @IsOptional()
  @IsNumber()
  @Min(0.01)
  amount?: number;

  @IsOptional()
  @IsString()
  reason?: string;
}

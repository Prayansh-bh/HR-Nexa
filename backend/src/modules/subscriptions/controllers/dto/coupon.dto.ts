import { IsString, IsNotEmpty, IsNumber, Min, Max, IsOptional } from 'class-validator';

export class CreateCouponDto {
  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsNumber()
  @Min(0)
  @Max(100)
  discountPercent!: number;

  @IsString()
  @IsNotEmpty()
  expiryDate!: string;

  @IsNumber()
  @IsOptional()
  @Min(1)
  maxUses?: number;
}

export class ApplyCouponDto {
  @IsString()
  @IsNotEmpty()
  code!: string;
}

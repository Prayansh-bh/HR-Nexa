import { IsString, IsOptional, IsBoolean } from 'class-validator';

export class SuspendSubscriptionDto {
  @IsString()
  @IsOptional()
  reason?: string;
}

export class CancelSubscriptionDto {
  @IsString()
  @IsOptional()
  note?: string;
}

export class AutoRenewSubscriptionDto {
  @IsBoolean()
  autoRenew!: boolean;
}

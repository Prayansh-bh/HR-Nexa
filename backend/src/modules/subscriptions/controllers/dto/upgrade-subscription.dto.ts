import { IsString, IsNotEmpty } from 'class-validator';

export class UpgradeSubscriptionDto {
  @IsString()
  @IsNotEmpty()
  plan!: string;
}

export class DowngradeSubscriptionDto {
  @IsString()
  @IsNotEmpty()
  plan!: string;
}

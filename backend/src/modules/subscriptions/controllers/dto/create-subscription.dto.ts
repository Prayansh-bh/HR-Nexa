import { IsString, IsNotEmpty, IsOptional, IsNumber, IsEmail, Min } from 'class-validator';

export class CreateSubscriptionDto {
  @IsString()
  @IsNotEmpty()
  company!: string;

  @IsString()
  @IsNotEmpty()
  plan!: string;

  @IsString()
  @IsOptional()
  cycle?: string;

  @IsString()
  @IsOptional()
  start?: string;

  @IsString()
  @IsOptional()
  expiry?: string;

  @IsNumber()
  @IsOptional()
  @Min(0)
  amount?: number;

  @IsString()
  @IsOptional()
  status?: string;

  @IsString()
  @IsOptional()
  gst?: string;

  @IsString()
  @IsOptional()
  pan?: string;

  @IsString()
  @IsOptional()
  cin?: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsString()
  @IsOptional()
  contact?: string;

  @IsString()
  @IsOptional()
  hrAdmin?: string;

  @IsString()
  @IsOptional()
  ownerName?: string;

  @IsEmail()
  @IsOptional()
  ownerEmail?: string;

  @IsString()
  @IsOptional()
  billing?: string;

  @IsString()
  @IsOptional()
  storageUsed?: string;

  @IsNumber()
  @IsOptional()
  @Min(0)
  employeesCount?: number;

  @IsNumber()
  @IsOptional()
  @Min(1)
  purchasedSeats?: number;
}

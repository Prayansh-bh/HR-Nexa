import {
  IsString,
  IsNotEmpty,
  IsEmail,
  IsOptional,
  MaxLength,
  Matches,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateCheckoutOrderDto {
  @IsString()
  @IsNotEmpty({ message: 'Company name is required' })
  @MaxLength(100, { message: 'Company name must not exceed 100 characters' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  company!: string;

  @IsString()
  @IsNotEmpty({ message: 'Plan identifier is required' })
  @MaxLength(50)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  plan!: string;

  @IsString()
  @IsNotEmpty({ message: 'Billing cycle is required' })
  @Matches(/^(Monthly|Annual|yearly|monthly)$/i, {
    message: 'Billing cycle must be either Monthly or Annual',
  })
  @Transform(({ value }) => {
    if (typeof value !== 'string') return value;
    const lower = value.trim().toLowerCase();
    if (lower === 'annual' || lower === 'yearly') return 'Annual';
    return 'Monthly';
  })
  cycle!: string;

  @IsString()
  @IsNotEmpty({ message: 'Owner name is required' })
  @MaxLength(100, { message: 'Owner name must not exceed 100 characters' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  ownerName!: string;

  @IsEmail({}, { message: 'A valid owner email address is required' })
  @IsNotEmpty({ message: 'Owner email is required' })
  @MaxLength(150)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  ownerEmail!: string;

  @IsString()
  @IsOptional()
  @MaxLength(30)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  contact?: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  gst?: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  address?: string;
}

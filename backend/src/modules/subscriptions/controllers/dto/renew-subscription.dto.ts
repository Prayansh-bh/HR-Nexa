import { IsString, IsIn, IsOptional, IsNumber, Min, Max } from 'class-validator';

export const VALID_RENEWAL_DURATIONS = [
  '14_DAYS',
  '1_MONTH',
  '1_YEAR',
  '14 Days',
  '1 Month',
  '1 Year',
  '14days',
  '1month',
  '1year',
  'Trial',
  'Monthly',
  'Annual',
  'trial',
  'monthly',
  'annual',
] as const;

export class RenewSubscriptionDto {
  @IsOptional()
  @IsString({ message: 'duration must be a string' })
  @IsIn(VALID_RENEWAL_DURATIONS, {
    message: 'duration must be one of: 14_DAYS, 1_MONTH, 1_YEAR (or Trial, Monthly, Annual)',
  })
  duration?: string;
}

export class ExtendTrialDto {
  @IsOptional()
  @IsNumber({}, { message: 'days must be a valid number' })
  @Min(1, { message: 'days must be at least 1' })
  @Max(365, { message: 'days cannot exceed 365' })
  days?: number;
}

import {
  IsString,
  IsNumber,
  IsBoolean,
  Min,
  Max,
  IsOptional,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';

export const SUPPORTED_CURRENCIES = [
  'INR (₹)',
  'INR',
  'USD ($)',
  'USD',
  'EUR (€)',
  'EUR',
  'GBP (£)',
  'GBP',
  'AED (AED)',
  'AED',
] as const;

export const SUPPORTED_DATE_FORMATS = [
  'YYYY-MM-DD',
  'DD/MM/YYYY',
  'MM/DD/YYYY',
] as const;

export const SUPPORTED_LANGUAGES_LIST = [
  'en',
  'hi',
  'English',
  'Hindi',
] as const;

export const SUPPORTED_TIMEZONES = [
  'UTC (Coordinated Universal Time)',
  'UTC',
  'IST (Indian Standard Time)',
  'Asia/Kolkata',
  'EST (Eastern Standard Time)',
  'America/New_York',
  'PST (Pacific Standard Time)',
  'America/Los_Angeles',
  'Europe/London',
  'GMT',
  'Asia/Dubai',
  'GST',
] as const;

export class UpdateGlobalSettingsDto {
  @IsOptional()
  @IsString()
  @IsIn(SUPPORTED_TIMEZONES, {
    message: 'Timezone must be one of the supported timezone identifiers',
  })
  timeZone?: string;

  @IsOptional()
  @IsString()
  @IsIn(SUPPORTED_CURRENCIES, {
    message: 'Currency must be one of the supported currency codes (e.g. INR, USD, EUR, GBP, AED)',
  })
  currency?: string;

  @IsOptional()
  @IsString()
  @IsIn(SUPPORTED_DATE_FORMATS, {
    message: 'Date format must be one of: YYYY-MM-DD, DD/MM/YYYY, MM/DD/YYYY',
  })
  dateFormat?: string;

  @IsOptional()
  @IsString()
  @IsIn(SUPPORTED_LANGUAGES_LIST, {
    message: 'Default language must be one of the supported language codes (en, hi)',
  })
  defaultLanguage?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Session timeout must be a valid number' })
  @Min(5, { message: 'Session timeout must be at least 5 minutes' })
  @Max(1440, { message: 'Session timeout cannot exceed 1440 minutes' })
  sessionTimeoutMins?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Trial days must be a valid number' })
  @Min(1, { message: 'Trial days must be at least 1 day' })
  @Max(365, { message: 'Trial days cannot exceed 365 days' })
  trialDays?: number;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean({ message: 'strictPasswordPolicy must be a boolean' })
  strictPasswordPolicy?: boolean;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean({ message: 'requireOtpLogin must be a boolean' })
  requireOtpLogin?: boolean;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean({ message: 'requireCompanyApproval must be a boolean' })
  requireCompanyApproval?: boolean;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean({ message: 'maintenanceMode must be a boolean' })
  maintenanceMode?: boolean;
}

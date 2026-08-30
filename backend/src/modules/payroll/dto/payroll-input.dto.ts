import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsNumber,
  IsOptional,
  Min,
  MaxLength,
  Matches,
} from 'class-validator';

export class UpdatePayrollInputDto {
  @ApiProperty({
    example: '2026-07',
    description: 'Payroll month in YYYY-MM or Month YYYY format (e.g. 2026-07 or July 2026)',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{4}-\d{2}$|^[A-Za-z]+\s+\d{4}$/, {
    message: 'Month must be in YYYY-MM or Month YYYY format (e.g. 2026-07 or July 2026)',
  })
  month: string;

  @ApiPropertyOptional({
    example: 2,
    description: 'Loss of Pay (LOP) days override (must be a finite number >= 0)',
  })
  @IsOptional()
  @IsNumber(
    { allowNaN: false, allowInfinity: false },
    { message: 'lopDays must be a finite number' },
  )
  @Min(0, { message: 'lopDays cannot be negative' })
  lopDays?: number;

  @ApiPropertyOptional({
    example: 8,
    description: 'Overtime hours (must be a finite number >= 0)',
  })
  @IsOptional()
  @IsNumber(
    { allowNaN: false, allowInfinity: false },
    { message: 'overtimeHours must be a finite number' },
  )
  @Min(0, { message: 'overtimeHours cannot be negative' })
  overtimeHours?: number;

  @ApiPropertyOptional({
    example: 5000,
    description: 'Bonus amount in currency (must be a finite number >= 0)',
  })
  @IsOptional()
  @IsNumber(
    { allowNaN: false, allowInfinity: false },
    { message: 'bonus must be a finite number' },
  )
  @Min(0, { message: 'bonus cannot be negative' })
  bonus?: number;

  @ApiPropertyOptional({
    example: 1000,
    description: 'Special deduction amount in currency (must be a finite number >= 0)',
  })
  @IsOptional()
  @IsNumber(
    { allowNaN: false, allowInfinity: false },
    { message: 'deductions must be a finite number' },
  )
  @Min(0, { message: 'deductions cannot be negative' })
  deductions?: number;

  @ApiPropertyOptional({
    example: 'July performance incentive',
    description: 'Optional remarks or justification for manual input override',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000, { message: 'remarks cannot exceed 1000 characters' })
  remarks?: string;

  @ApiPropertyOptional({
    example: 'company-uuid',
    description: 'Target company ID for SuperAdmin tenant context',
  })
  @IsOptional()
  @IsString()
  companyId?: string;
}

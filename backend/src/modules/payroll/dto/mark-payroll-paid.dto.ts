import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class MarkPayrollPaidDto {
  @ApiProperty({
    example: 'August 2026',
    description: 'The payroll month name (e.g., "August 2026")',
  })
  @IsNotEmpty({ message: 'month is required' })
  @IsString({ message: 'month must be a string' })
  month: string;

  @ApiProperty({
    example: '2026-08-31',
    description: 'Disbursement / payment date (YYYY-MM-DD)',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'payDate must be a string' })
  payDate?: string;

  @ApiProperty({
    example: 'HDFC-UTR-99182391',
    description: 'Optional UTR or bank disbursement reference',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'paymentReference must be a string' })
  paymentReference?: string;

  @ApiProperty({
    example: 'ac56fa51-576a-4ad9-a133-010568e74d9b',
    description: 'Target company ID (SuperAdmin platform override only)',
    required: false,
  })
  @IsOptional()
  @IsString()
  companyId?: string;
}

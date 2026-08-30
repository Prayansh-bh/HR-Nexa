import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsOptional,
} from 'class-validator';
import { EmployeeAdjustmentDto, IsEmployeeAdjustmentMap } from './batch-process-payroll.dto';

export class GeneratePayrollDto {
  @ApiProperty({
    example: 'August 2026',
    description: 'Month/Year representation for draft generation (e.g. "August 2026" or "2026-08")',
  })
  @IsNotEmpty({ message: 'month is required for draft generation' })
  @IsString({ message: 'month must be a string' })
  month: string;

  @ApiPropertyOptional({
    example: '2026-08-31',
    description: 'Tentative pay date YYYY-MM-DD',
  })
  @IsOptional()
  @IsString()
  payDate?: string;

  @ApiPropertyOptional({
    description: 'Target company ID (SuperAdmin context only)',
  })
  @IsOptional()
  @IsString()
  companyId?: string;

  @ApiPropertyOptional({
    description: 'Optional map of employee adjustments to incorporate into draft calculations',
  })
  @IsOptional()
  @IsEmployeeAdjustmentMap()
  adjustments?: Record<string, EmployeeAdjustmentDto>;
}

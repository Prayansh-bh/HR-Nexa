import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsNumber,
  IsOptional,
  Min,
  MaxLength,
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
  validateSync,
} from 'class-validator';
import { plainToInstance } from 'class-transformer';

export class EmployeeAdjustmentDto {
  @ApiPropertyOptional({
    example: 1.5,
    description: 'LOP Days override (must be a finite number >= 0)',
  })
  @IsOptional()
  @IsNumber(
    { allowNaN: false, allowInfinity: false },
    { message: 'LOPDays must be a finite number' },
  )
  @Min(0, { message: 'LOPDays cannot be negative' })
  LOPDays?: number;

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
    description: 'Bonus amount (must be a finite number >= 0)',
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
    description: 'Extra deductions (must be a finite number >= 0)',
  })
  @IsOptional()
  @IsNumber(
    { allowNaN: false, allowInfinity: false },
    { message: 'deductions must be a finite number' },
  )
  @Min(0, { message: 'deductions cannot be negative' })
  deductions?: number;

  @ApiPropertyOptional({
    example: 250,
    description: 'PT Override (must be a finite number >= 0)',
  })
  @IsOptional()
  @IsNumber(
    { allowNaN: false, allowInfinity: false },
    { message: 'ptOverride must be a finite number' },
  )
  @Min(0, { message: 'ptOverride cannot be negative' })
  ptOverride?: number;

  @ApiPropertyOptional({
    example: 'Performance bonus',
    description: 'Adjustment remarks',
  })
  @IsOptional()
  @IsString({ message: 'remarks must be a string' })
  @MaxLength(500, { message: 'remarks must not exceed 500 characters' })
  remarks?: string;
}

export function IsEmployeeAdjustmentMap(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      name: 'isEmployeeAdjustmentMap',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value: any, args: ValidationArguments) {
          if (value === undefined || value === null) return true;
          if (typeof value !== 'object' || Array.isArray(value)) return false;

          for (const key of Object.keys(value)) {
            if (typeof key !== 'string' || !key.trim()) return false;
            const item = value[key];
            if (typeof item !== 'object' || item === null || Array.isArray(item)) return false;

            const dtoInstance = plainToInstance(EmployeeAdjustmentDto, item);
            const errors = validateSync(dtoInstance, {
              whitelist: true,
              forbidNonWhitelisted: true,
            });
            if (errors.length > 0) {
              return false;
            }
          }
          return true;
        },
        defaultMessage(args: ValidationArguments) {
          return 'adjustments must be a valid map of employee ID to employee adjustment objects with finite non-negative numbers and valid fields';
        },
      },
    });
  };
}

export class BatchProcessPayrollDto {
  @ApiProperty({
    example: 'July 2026',
    description: 'Month/Year representation',
  })
  @IsNotEmpty()
  @IsString()
  month: string;

  @ApiProperty({
    example: '2026-07-31',
    description: 'Pay date YYYY-MM-DD',
    required: false,
  })
  @IsOptional()
  @IsString()
  payDate?: string;

  @ApiProperty({
    example: 'Processed',
    description: 'Payroll status',
    required: false,
  })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({
    description: 'Target company ID (SuperAdmin only)',
  })
  @IsOptional()
  @IsString()
  companyId?: string;

  @ApiPropertyOptional({
    description: 'Map of employee adjustments',
  })
  @IsOptional()
  @IsEmployeeAdjustmentMap()
  adjustments?: Record<string, EmployeeAdjustmentDto>;
}

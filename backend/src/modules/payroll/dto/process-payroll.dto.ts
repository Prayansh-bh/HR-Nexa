import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsNumber,
  IsOptional,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ProcessPayrollDto {
  @ApiProperty({ example: 'EMP001', description: 'Employee ID' })
  @IsNotEmpty()
  @IsString()
  employeeId: string;

  @ApiProperty({
    example: 'July 2026',
    description: 'Month/Year representation',
  })
  @IsNotEmpty()
  @IsString()
  month: string;

  @ApiProperty({ example: '2026-07-31', description: 'Pay date YYYY-MM-DD' })
  @IsNotEmpty()
  @IsString()
  payDate: string;

  @ApiProperty({ example: 46000, description: 'Basic Salary Component' })
  @IsNotEmpty()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  basicSalary: number;

  @ApiProperty({ example: 27600, description: 'Allowances' })
  @IsNotEmpty()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  allowances: number;

  @ApiProperty({ example: 9200, description: 'Deductions' })
  @IsNotEmpty()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  deductions: number;

  @ApiProperty({ example: 64400, description: 'Net Salary' })
  @IsNotEmpty()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  netSalary: number;

  @ApiProperty({
    example: 'Processed',
    description: 'Draft | Processed | Paid',
  })
  @IsNotEmpty()
  @IsString()
  status: string;

  @ApiProperty({
    example: '[]',
    required: false,
    description: 'JSON string list of warnings',
  })
  @IsOptional()
  @IsString()
  warnings?: string;
}

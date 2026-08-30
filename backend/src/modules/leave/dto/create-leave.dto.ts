import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsNumber,
  IsOptional,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateLeaveDto {
  @ApiProperty({ example: 'EMP001', description: 'Employee ID' })
  @IsNotEmpty()
  @IsString()
  employeeId: string;

  @ApiProperty({
    example: 'Annual',
    description: 'Annual | Sick | Casual | Maternity/Paternity',
  })
  @IsNotEmpty()
  @IsString()
  type: string;

  @ApiProperty({ example: '2026-07-20', description: 'Start date YYYY-MM-DD' })
  @IsNotEmpty()
  @IsString()
  from: string;

  @ApiProperty({ example: '2026-07-24', description: 'End date YYYY-MM-DD' })
  @IsNotEmpty()
  @IsString()
  to: string;

  @ApiProperty({ example: 5, description: 'Number of leave days' })
  @IsNotEmpty()
  @Type(() => Number)
  @IsNumber()
  @Min(0.5)
  days: number;

  @ApiProperty({
    example: 'Going for vacation',
    description: 'Reason for leave',
  })
  @IsNotEmpty()
  @IsString()
  reason: string;

  @ApiProperty({ example: 'Engineering', required: false })
  @IsOptional()
  @IsString()
  department?: string;
}

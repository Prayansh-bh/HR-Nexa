import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsNumber,
  IsInt,
  IsBoolean,
  IsOptional,
  Min,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateLeaveTypeDto {
  @ApiProperty({ example: 'Casual Leave', description: 'Name of leave policy' })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({ example: 12, description: 'Total annual days entitlement' })
  @IsNotEmpty()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  days: number;

  @ApiProperty({ example: 'emerald', required: false, description: 'UI Badge color theme' })
  @IsOptional()
  @IsString()
  tone?: string;

  @ApiProperty({ example: 1.0, required: false, description: 'Monthly accrual rate' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  accrualRate?: number;

  @ApiProperty({ example: 12, required: false, description: 'Maximum cap threshold' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxCap?: number;

  @ApiProperty({ example: false, required: false, description: 'Carry forward enabled' })
  @IsOptional()
  @IsBoolean()
  carryForward?: boolean;

  @ApiProperty({ example: false, required: false, description: 'Encashable enabled' })
  @IsOptional()
  @IsBoolean()
  encashable?: boolean;

  @ApiProperty({ example: true, required: false, description: 'Paid leave policy' })
  @IsOptional()
  @IsBoolean()
  paid?: boolean;

  @ApiProperty({ example: 'Monthly', required: false, description: 'Monthly | Quarterly | Annual' })
  @IsOptional()
  @IsString()
  @IsIn(['Monthly', 'Quarterly', 'Annual'])
  accrualFrequency?: string;
}

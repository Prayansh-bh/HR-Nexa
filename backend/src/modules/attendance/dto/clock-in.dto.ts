import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsOptional, IsBoolean } from 'class-validator';

export class ClockInDto {
  @ApiProperty({ example: 'EMP001', required: false, description: 'Employee ID (optional for self clock-in)' })
  @IsOptional()
  @IsString()
  employeeId?: string;

  @ApiProperty({ example: '2026-07-21', description: 'Date YYYY-MM-DD' })
  @IsNotEmpty()
  @IsString()
  date: string;

  @ApiProperty({ example: '09:00', required: false, description: 'Time HH:MM' })
  @IsOptional()
  @IsString()
  inTime?: string;

  @ApiProperty({ example: '18:00', required: false, description: 'Time HH:MM' })
  @IsOptional()
  @IsString()
  outTime?: string;

  @ApiProperty({ example: 'Present', required: false, description: 'Status' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiProperty({ example: 'Ontime clock-in', required: false })
  @IsOptional()
  @IsString()
  remarks?: string;

  @ApiProperty({ example: '12.9716', required: false })
  @IsOptional()
  latitude?: string | number;

  @ApiProperty({ example: '77.5946', required: false })
  @IsOptional()
  longitude?: string | number;

  @ApiProperty({ example: 25, required: false, description: 'GPS accuracy in meters' })
  @IsOptional()
  accuracy?: number;

  @ApiProperty({ example: 'WEB_APP', required: false })
  @IsOptional()
  @IsString()
  deviceId?: string;

  @ApiProperty({ example: '192.168.1.1', required: false })
  @IsOptional()
  @IsString()
  ipAddress?: string;

  @ApiProperty({ example: false, required: false })
  @IsOptional()
  @IsBoolean()
  verified?: boolean;
}

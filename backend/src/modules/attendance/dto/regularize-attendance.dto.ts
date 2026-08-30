import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class RegularizeAttendanceDto {
  @ApiPropertyOptional({ example: '09:00' })
  @IsOptional()
  @IsString()
  inTime?: string;

  @ApiPropertyOptional({ example: '18:00' })
  @IsOptional()
  @IsString()
  outTime?: string;

  @ApiPropertyOptional({ example: 'System clock-in error' })
  @IsOptional()
  @IsString()
  remarks?: string;
}

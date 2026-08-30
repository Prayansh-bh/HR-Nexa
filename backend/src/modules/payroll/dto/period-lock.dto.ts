import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class PeriodLockDto {
  @ApiProperty({
    example: 'July 2026',
    description: 'Month/Year to lock/unlock',
  })
  @IsNotEmpty()
  @IsString()
  month: string;
}

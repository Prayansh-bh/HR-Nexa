import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsString } from 'class-validator';

export class UpdateLeaveStatusDto {
  @ApiProperty({ example: 'Approved', enum: ['Approved', 'Rejected'] })
  @IsNotEmpty()
  @IsString()
  @IsIn(['Approved', 'Rejected'])
  status: 'Approved' | 'Rejected';
}

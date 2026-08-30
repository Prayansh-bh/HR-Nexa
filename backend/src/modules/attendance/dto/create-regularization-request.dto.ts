import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateRegularizationRequestDto {
  @ApiProperty({ description: 'ID of the attendance record to regularize' })
  @IsNotEmpty()
  @IsString()
  attendanceId: string;

  @ApiProperty({ example: '09:00' })
  @IsNotEmpty()
  @IsString()
  requestedInTime: string;

  @ApiProperty({ example: '18:00' })
  @IsNotEmpty()
  @IsString()
  requestedOutTime: string;

  @ApiProperty({ example: 'Network issues during check-in' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(250)
  reason: string;
}

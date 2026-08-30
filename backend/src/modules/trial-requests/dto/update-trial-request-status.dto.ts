import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsIn, IsOptional, MaxLength } from 'class-validator';

export class UpdateTrialRequestStatusDto {
  @ApiProperty({
    example: 'CONTACTED',
    enum: ['PENDING', 'CONTACTED', 'PROVISIONED', 'REJECTED'],
    description: 'Updated status of the trial lead',
  })
  @IsNotEmpty({ message: 'Status is required' })
  @IsString({ message: 'Status must be a string' })
  @IsIn(['PENDING', 'CONTACTED', 'PROVISIONED', 'REJECTED'], {
    message: 'Status must be one of: PENDING, CONTACTED, PROVISIONED, REJECTED',
  })
  status: string;

  @ApiPropertyOptional({
    example: 'Called customer on WhatsApp, scheduled demo for tomorrow 3 PM.',
    description: 'SuperAdmin internal notes',
  })
  @IsOptional()
  @IsString({ message: 'Admin notes must be a string' })
  @MaxLength(1000, { message: 'Admin notes must not exceed 1000 characters' })
  adminNotes?: string;
}

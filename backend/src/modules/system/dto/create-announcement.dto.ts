import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsDateString } from 'class-validator';

export class CreateAnnouncementDto {
  @ApiProperty({ example: 'Company Holiday Notice' })
  @IsNotEmpty()
  @IsString()
  title: string;

  @ApiProperty({ example: 'The office will be closed on Friday...' })
  @IsNotEmpty()
  @IsString()
  content: string;

  @ApiPropertyOptional({
    example: 'Maintenance',
    enum: ['Maintenance', 'Release', 'Security', 'Notice'],
    description: 'Category / Type of Announcement',
  })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional({
    example: '2026-08-30T02:00:00.000Z',
    description: 'ISO 8601 UTC timestamp of scheduled start time',
  })
  @IsOptional()
  @IsDateString({}, { message: 'scheduledFor must be a valid ISO 8601 date string' })
  scheduledFor?: string;

  @ApiPropertyOptional({
    example: '2 Hours',
    description: 'Estimated duration of event or maintenance window',
  })
  @IsOptional()
  @IsString()
  duration?: string;
}


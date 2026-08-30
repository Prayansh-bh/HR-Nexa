import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsNumber,
  Min,
  Max,
  IsOptional,
  IsBoolean,
  MaxLength,
} from 'class-validator';

export class CreateGeoZoneDto {
  @ApiProperty({
    example: 'Pune HQ',
    description: 'Name of the geo-fencing zone (unique per tenant)',
  })
  @IsNotEmpty()
  @IsString()
  @MaxLength(250)
  name: string;

  @ApiProperty({
    example: 18.5204,
    description: 'Latitude in decimal degrees (-90 to +90)',
  })
  @IsNotEmpty()
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude: number;

  @ApiProperty({
    example: 73.8567,
    description: 'Longitude in decimal degrees (-180 to +180)',
  })
  @IsNotEmpty()
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude: number;

  @ApiProperty({
    example: 150,
    description: 'Geofence radius in meters (1 to 10,000 meters)',
  })
  @IsNotEmpty()
  @IsNumber()
  @Min(1)
  @Max(10000)
  radiusMeters: number;

  @ApiPropertyOptional({
    example: 'MG Road, Pune, Maharashtra',
    description: 'Optional human-readable address description',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  @ApiPropertyOptional({
    example: true,
    description: 'Whether this geo-fencing zone is active for attendance enforcement',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

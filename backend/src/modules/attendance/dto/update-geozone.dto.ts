import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { CreateGeoZoneDto } from './create-geozone.dto';
import {
  IsOptional,
  IsString,
  IsNumber,
  Min,
  Max,
  IsBoolean,
  MaxLength,
} from 'class-validator';

export class UpdateGeoZoneDto extends PartialType(CreateGeoZoneDto) {
  @ApiPropertyOptional({ example: 'Pune HQ' })
  @IsOptional()
  @IsString()
  @MaxLength(250)
  name?: string;

  @ApiPropertyOptional({ example: 18.5204 })
  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @ApiPropertyOptional({ example: 73.8567 })
  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;

  @ApiPropertyOptional({ example: 150 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(10000)
  radiusMeters?: number;

  @ApiPropertyOptional({ example: 'MG Road, Pune, Maharashtra' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

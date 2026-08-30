import { IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PreviewOfferDto {
  @ApiProperty({ example: 800000, description: 'Proposed Annual CTC in INR' })
  @IsNotEmpty()
  @IsNumber()
  @Min(1000)
  annualCTC: number;

  @ApiPropertyOptional({ example: 'Software Engineer' })
  @IsOptional()
  @IsString()
  designation?: string;

  @ApiPropertyOptional({ example: '2026-09-01' })
  @IsOptional()
  @IsString()
  joiningDate?: string;

  @ApiPropertyOptional({ example: '2026-08-30' })
  @IsOptional()
  @IsString()
  expiryDate?: string;
}

export class GenerateOfferDto {
  @ApiProperty({ example: 800000, description: 'Agreed Annual CTC in INR' })
  @IsNotEmpty()
  @IsNumber()
  @Min(1000)
  annualCTC: number;

  @ApiProperty({ example: 'Senior Software Engineer' })
  @IsNotEmpty()
  @IsString()
  designation: string;

  @ApiProperty({ example: '2026-09-01' })
  @IsNotEmpty()
  @IsString()
  joiningDate: string;

  @ApiPropertyOptional({ example: '2026-08-30' })
  @IsOptional()
  @IsString()
  expiryDate?: string;

  @ApiPropertyOptional({ example: 'Standard probation of 3 months applies.' })
  @IsOptional()
  @IsString()
  terms?: string;
}

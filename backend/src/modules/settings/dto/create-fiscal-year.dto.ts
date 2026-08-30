import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsDateString } from 'class-validator';

export class CreateFiscalYearDto {
  @ApiProperty({ example: 'FY 2026-27', description: 'Year identifier' })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({ example: '2026-04-01', description: 'Start date YYYY-MM-DD' })
  @IsNotEmpty()
  @IsDateString()
  startDate: string;

  @ApiProperty({ example: '2027-03-31', description: 'End date YYYY-MM-DD' })
  @IsNotEmpty()
  @IsDateString()
  endDate: string;
}

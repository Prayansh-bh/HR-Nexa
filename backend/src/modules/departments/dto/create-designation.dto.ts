import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CreateDesignationDto {
  @ApiProperty({ example: 'Sr. Engineer', description: 'Designation Name' })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({ example: 'L3', description: 'Pay Band / Grade' })
  @IsNotEmpty()
  @IsString()
  band: string;
}

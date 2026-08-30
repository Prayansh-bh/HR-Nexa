import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsOptional } from 'class-validator';

export class CreateDepartmentDto {
  @ApiProperty({ example: 'Engineering', description: 'Department Name' })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({
    example: 'Aarav Sharma',
    description: 'Head of Department (Employee name)',
    required: false,
  })
  @IsOptional()
  @IsString()
  head?: string;
}

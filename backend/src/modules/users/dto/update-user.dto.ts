import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class UpdateUserDto {
  @ApiPropertyOptional({
    description:
      'Role of the user (e.g. SuperAdmin, HRAdmin, Employee, Manager, Accountant)',
    example: 'HRAdmin',
  })
  @IsOptional()
  @IsString()
  role?: string;

  @ApiPropertyOptional({
    description: 'Account status (e.g. Active, Inactive, Locked, Disabled)',
    example: 'Inactive',
  })
  @IsOptional()
  @IsString()
  status?: string;
}

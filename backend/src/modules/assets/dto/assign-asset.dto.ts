import { IsString, IsNotEmpty, IsOptional, IsDateString, IsEnum } from 'class-validator';

export class AssignAssetDto {
  @IsString()
  @IsNotEmpty()
  employeeId: string;

  @IsOptional()
  @IsDateString()
  assignedDate?: string;

  @IsOptional()
  @IsEnum(['New', 'Good', 'Fair', 'Damaged'])
  condition?: string;

  @IsOptional()
  @IsString()
  remarks?: string;
}

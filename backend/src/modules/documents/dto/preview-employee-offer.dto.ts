import { IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class PreviewEmployeeOfferDto {
  @IsNotEmpty()
  @IsString()
  employeeId: string;

  @IsNotEmpty()
  @IsNumber()
  @Min(1)
  annualCTC: number;

  @IsOptional()
  @IsString()
  designation?: string;

  @IsOptional()
  @IsString()
  joiningDate?: string;

  @IsOptional()
  @IsString()
  expiryDate?: string;
}

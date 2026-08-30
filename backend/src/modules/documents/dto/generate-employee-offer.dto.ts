import { IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class GenerateEmployeeOfferDto {
  @IsNotEmpty()
  @IsString()
  employeeId: string;

  @IsNotEmpty()
  @IsNumber()
  @Min(1)
  annualCTC: number;

  @IsNotEmpty()
  @IsString()
  designation: string;

  @IsNotEmpty()
  @IsString()
  joiningDate: string;

  @IsOptional()
  @IsString()
  expiryDate?: string;

  @IsOptional()
  @IsString()
  terms?: string;
}

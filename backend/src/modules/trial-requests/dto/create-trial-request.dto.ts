import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsEmail,
  IsOptional,
  IsArray,
  MaxLength,
} from 'class-validator';

export class CreateTrialRequestDto {
  @ApiProperty({
    example: 'Priya Sharma',
    description: 'Full name of the trial requester',
  })
  @IsNotEmpty({ message: 'Full name is required' })
  @IsString({ message: 'Full name must be a string' })
  @MaxLength(100, { message: 'Full name must not exceed 100 characters' })
  fullName: string;

  @ApiProperty({
    example: 'priya@company.com',
    description: 'Business / work email address',
  })
  @IsNotEmpty({ message: 'Work email is required' })
  @IsEmail({}, { message: 'Please enter a valid work email address' })
  @MaxLength(150, { message: 'Email must not exceed 150 characters' })
  workEmail: string;

  @ApiProperty({
    example: '+91 98765 43210',
    description: 'Contact phone / WhatsApp number',
  })
  @IsNotEmpty({ message: 'Phone number is required' })
  @IsString({ message: 'Phone number must be a string' })
  @MaxLength(30, { message: 'Phone number must not exceed 30 characters' })
  phoneNumber: string;

  @ApiProperty({
    example: 'Acme Technologies Pvt Ltd',
    description: 'Company / Organization name',
  })
  @IsNotEmpty({ message: 'Company name is required' })
  @IsString({ message: 'Company name must be a string' })
  @MaxLength(150, { message: 'Company name must not exceed 150 characters' })
  companyName: string;

  @ApiProperty({
    example: '11 - 50 Employees',
    description: 'Team or company size category',
  })
  @IsNotEmpty({ message: 'Team size is required' })
  @IsString({ message: 'Team size must be a string' })
  @MaxLength(50, { message: 'Team size must not exceed 50 characters' })
  teamSize: string;

  @ApiPropertyOptional({
    example: ['Payroll & Statutory', 'Attendance & Biometrics'],
    description: 'Selected modules to explore during trial',
    type: [String],
  })
  @IsOptional()
  @IsArray({ message: 'Selected modules must be an array of strings' })
  @IsString({ each: true, message: 'Each selected module must be a string' })
  selectedModules?: string[];

  @ApiPropertyOptional({
    example: 'We are switching from our legacy HRMS and need migration help.',
    description: 'Optional custom message or notes',
  })
  @IsOptional()
  @IsString({ message: 'Message must be a string' })
  @MaxLength(1000, { message: 'Message must not exceed 1000 characters' })
  message?: string;
}

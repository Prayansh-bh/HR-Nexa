import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsNumber,
  IsOptional,
  IsEmail,
  Min,
  Matches,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateEmployeeDto {
  @ApiProperty({
    example: 'EMP007',
    description: 'Unique employee ID (auto-generated if omitted)',
    required: false,
  })
  @IsOptional()
  @IsString()
  id?: string;

  @ApiProperty({ example: 'Jane Smith', description: 'Full name' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(250, { message: 'Name must not exceed 250 characters' })
  @Matches(/^[a-zA-Z\s]+$/, {
    message: 'Name must contain only alphabets and spaces',
  })
  name: string;

  @ApiProperty({ example: 'jane.smith@acme.co', description: 'Work email' })
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Engineering', description: 'Department name' })
  @IsNotEmpty()
  @IsString()
  departmentName: string;

  @ApiProperty({ example: 'Frontend Dev', description: 'Designation name' })
  @IsNotEmpty()
  @IsString()
  designation: string;

  @ApiProperty({
    example: 'Active',
    description: 'Active | On Leave | Inactive',
  })
  @IsNotEmpty()
  @IsString()
  status: string;

  @ApiProperty({
    example: '2026-07-21',
    description: 'Date joined (ISO YYYY-MM-DD)',
  })
  @IsNotEmpty()
  @IsString()
  joined: string;

  @ApiProperty({ example: 85000, description: 'Monthly base salary' })
  @IsNotEmpty()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  salary: number;

  @ApiProperty({ example: 'JS', description: 'Initials or avatar code' })
  @IsNotEmpty()
  @IsString()
  avatar: string;

  @ApiProperty({ example: '+91 98100 88888', required: false })
  @IsOptional()
  @IsString()
  @Matches(/^\+?[0-9\s\-]{10,15}$/, {
    message: 'Phone number must be numeric and between 10 to 15 digits',
  })
  phone?: string;

  @ApiProperty({ example: 'Bengaluru, IN', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Address must not exceed 500 characters' })
  address?: string;

  @ApiProperty({ example: '1995-05-15', required: false })
  @IsOptional()
  @IsString()
  dob?: string;

  @ApiProperty({ example: 'Female', required: false })
  @IsOptional()
  @IsString()
  gender?: string;

  @ApiProperty({ example: '100987654329', required: false })
  @IsOptional()
  @IsString()
  @Matches(/^\d{12}$/, { message: 'UAN must be exactly 12 digits' })
  uan?: string;

  @ApiProperty({ example: '1112345689', required: false })
  @IsOptional()
  @IsString()
  esic?: string;

  @ApiProperty({ example: 'GGGGG7777G', required: false })
  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, {
    message: 'PAN must follow standard format (e.g. ABCDE1234F)',
  })
  pan?: string;

  @ApiProperty({ example: '7890 1234 5678', required: false })
  @IsOptional()
  @IsString()
  @Matches(/^\d{12}$/, { message: 'Aadhaar must be exactly 12 digits' })
  aadhaar?: string;

  @ApiProperty({ example: 'HDFC Bank', required: false })
  @IsOptional()
  @IsString()
  bankName?: string;

  @ApiProperty({ example: '50100234567890', required: false })
  @IsOptional()
  @IsString()
  accountNumber?: string;

  @ApiProperty({ example: 'HDFC0001234', required: false })
  @IsOptional()
  @IsString()
  ifscCode?: string;

  @ApiProperty({ example: 'Bengaluru HQ', required: false })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiProperty({ example: 'Single', required: false })
  @IsOptional()
  @IsString()
  maritalStatus?: string;

  @ApiProperty({ example: 'B+', required: false })
  @IsOptional()
  @IsString()
  bloodGroup?: string;

  @ApiProperty({ example: 'Z1234567', required: false })
  @IsOptional()
  @IsString()
  passportNumber?: string;

  @ApiProperty({ example: 'jane.personal@gmail.com', required: false })
  @IsOptional()
  @IsEmail()
  personalEmail?: string;

  @ApiProperty({ example: 'Permanent Address St, Bengaluru', required: false })
  @IsOptional()
  @IsString()
  permanentAddress?: string;

  @ApiProperty({ example: 'John Smith', required: false })
  @IsOptional()
  @IsString()
  emergencyContactNamePrimary?: string;

  @ApiProperty({ example: 'Father', required: false })
  @IsOptional()
  @IsString()
  emergencyContactRelPrimary?: string;

  @ApiProperty({ example: '+91 98100 77777', required: false })
  @IsOptional()
  @IsString()
  emergencyContactPhonePrimary?: string;

  @ApiProperty({ example: 'Mary Smith', required: false })
  @IsOptional()
  @IsString()
  emergencyContactNameSecondary?: string;

  @ApiProperty({ example: 'Mother', required: false })
  @IsOptional()
  @IsString()
  emergencyContactRelSecondary?: string;

  @ApiProperty({ example: '+91 98100 66666', required: false })
  @IsOptional()
  @IsString()
  emergencyContactPhoneSecondary?: string;

  @ApiProperty({ example: 'data:image/png;base64,...', required: false })
  @IsOptional()
  @IsString()
  photoData?: string;

  @ApiProperty({ example: 0, required: false })
  @IsOptional()
  @IsNumber()
  photoRotation?: number;

  @ApiProperty({
    example: true,
    required: false,
    description: 'Create user login account',
  })
  @IsOptional()
  createAccount?: boolean;

  @ApiProperty({
    example: 'some-role-uuid',
    required: false,
    description: 'Role ID',
  })
  @IsOptional()
  @IsString()
  roleId?: string;

  @ApiProperty({
    example: 'EMP001',
    required: false,
    description: 'Manager employee ID',
  })
  @IsOptional()
  @IsString()
  managerId?: string;
}

import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  MinLength,
} from 'class-validator';
import { Role } from '../role.enum';

export class RegisterDto {
  @ApiProperty({ example: 'priya@acme.co', description: 'User email' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: 'demo1234', description: 'User password' })
  @IsNotEmpty()
  @MinLength(6)
  password: string;

  @ApiProperty({ example: 'Priya Menon', description: 'Full name' })
  @IsNotEmpty()
  name: string;

  @ApiProperty({ enum: Role, example: Role.Employee, description: 'User role' })
  @IsEnum(Role)
  @IsNotEmpty()
  role: Role;

  @ApiProperty({ example: 'PM', required: false, description: 'Initials' })
  @IsOptional()
  initials?: string;
}

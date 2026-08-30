import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, Length, Matches } from 'class-validator';
import { Transform } from 'class-transformer';

export class RequestSuperAdminEmailChangeDto {
  @ApiProperty({
    example: 'SuperSecret123!',
    description: 'Current SuperAdmin password for security authorization',
  })
  @IsNotEmpty({ message: 'Current password is required' })
  @IsString()
  currentPassword: string;

  @ApiProperty({
    example: 'new-owner@hrnexa.com',
    description: 'New email address to bind to SuperAdmin account',
  })
  @IsNotEmpty({ message: 'New email address is required' })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  newEmail: string;
}

export class VerifySuperAdminEmailChangeDto {
  @ApiProperty({
    example: 'a1b2c3d4e5f6...',
    description: 'Cryptographic challenge token issued during email change request',
  })
  @IsNotEmpty({ message: 'Challenge token is required' })
  @IsString()
  challengeToken: string;

  @ApiProperty({
    example: '123456',
    description: '6-digit verification OTP code received on the new email address',
  })
  @IsNotEmpty({ message: 'Verification OTP code is required' })
  @IsString()
  @Length(6, 6, { message: 'Verification OTP code must be exactly 6 digits' })
  @Matches(/^\d{6}$/, { message: 'Verification OTP code must contain digits only' })
  otp: string;

  @ApiProperty({
    example: 'new-owner@hrnexa.com',
    description: 'Requested new email address to cross-verify against stored challenge',
  })
  @IsNotEmpty({ message: 'New email address is required' })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  newEmail: string;
}

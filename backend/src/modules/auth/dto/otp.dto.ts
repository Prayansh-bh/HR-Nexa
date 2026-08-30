import { IsNotEmpty, IsString, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VerifyOtpDto {
  @ApiProperty({ description: 'Temporary Challenge Token issued during login' })
  @IsString()
  @IsNotEmpty()
  challengeToken: string;

  @ApiProperty({ description: '6-digit One-Time Password', example: '123456' })
  @IsString()
  @IsNotEmpty()
  @Length(6, 6, { message: 'OTP must be exactly 6 digits' })
  otp: string;
}

export class ResendOtpDto {
  @ApiProperty({ description: 'Temporary Challenge Token issued during login' })
  @IsString()
  @IsNotEmpty()
  challengeToken: string;
}

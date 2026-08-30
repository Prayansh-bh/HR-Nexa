import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty } from 'class-validator';

export class ForgotPasswordDto {
  @ApiProperty({
    example: 'user@company.com',
    description: 'Registered user email',
  })
  @IsNotEmpty()
  @IsEmail()
  email: string;
}

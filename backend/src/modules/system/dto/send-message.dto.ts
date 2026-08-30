import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class SendMessageDto {
  @ApiProperty({ example: 'usr-uuid-here' })
  @IsNotEmpty()
  @IsString()
  receiverId: string;

  @ApiProperty({ example: 'Project Update' })
  @IsNotEmpty()
  @IsString()
  subject: string;

  @ApiProperty({ example: 'Please review the latest project specifications.' })
  @IsNotEmpty()
  @IsString()
  body: string;
}

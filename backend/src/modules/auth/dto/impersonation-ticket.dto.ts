import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class ExchangeImpersonationTicketDto {
  @ApiProperty({ description: 'One-time signed cryptographic impersonation ticket' })
  @IsNotEmpty()
  @IsString()
  ticket: string;
}

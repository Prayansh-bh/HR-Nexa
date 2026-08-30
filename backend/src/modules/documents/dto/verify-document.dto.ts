import { IsString, IsOptional, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class VerifyDocumentDto {
  @ApiPropertyOptional({ description: 'Optional verification note', example: 'Verified against government portal' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

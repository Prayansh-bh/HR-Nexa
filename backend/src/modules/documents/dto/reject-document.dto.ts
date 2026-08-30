import { IsString, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RejectDocumentDto {
  @ApiProperty({ description: 'Mandatory reason for document rejection', example: 'Aadhaar copy is blurry and illegible' })
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  reason: string;
}

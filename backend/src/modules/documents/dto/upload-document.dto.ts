import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UploadDocumentDto {
  @ApiProperty({ example: 'EMP001', description: 'Employee ID' })
  @IsNotEmpty()
  @IsString()
  employeeId: string;

  @ApiProperty({
    example: 'Offer Letter',
    description: 'Document type (Offer, Appointment, ID Proof, etc.)',
  })
  @IsNotEmpty()
  @IsString()
  docType: string;

  @ApiProperty({ example: 'OfferLetter_EMP001.pdf', description: 'File name' })
  @IsNotEmpty()
  @IsString()
  fileName: string;

  @ApiProperty({ example: '1.2 MB', description: 'Formatted size string' })
  @IsNotEmpty()
  @IsString()
  size: string;

  @ApiPropertyOptional({
    example: 'data:application/pdf;base64,...',
    description: 'Base64 file contents or URL',
  })
  @IsOptional()
  @IsString()
  fileData?: string;
}

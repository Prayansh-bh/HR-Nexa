import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CreateAuditLogDto {
  @ApiProperty({ example: 'UPDATE_EMPLOYEE' })
  @IsNotEmpty()
  @IsString()
  action: string;

  @ApiProperty({ example: 'Updated salary details for EMP001' })
  @IsNotEmpty()
  @IsString()
  details: string;
}

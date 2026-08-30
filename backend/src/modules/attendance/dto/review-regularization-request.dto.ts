import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ReviewRegularizationRequestDto {
  @ApiPropertyOptional({ example: 'Verified attendance with manager' })
  @IsOptional()
  @IsString()
  @MaxLength(250)
  reviewerRemark?: string;
}

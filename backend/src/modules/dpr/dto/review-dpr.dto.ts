import { IsString, IsOptional } from 'class-validator';

export class ReviewDprDto {
  @IsString()
  @IsOptional()
  reviewerRemark?: string;
}

import {
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CriterionScoreItemDto } from './criterion-score-item.dto';

export class SubmitSelfReviewDto {
  @IsString()
  @IsOptional()
  @MaxLength(2000)
  feedback?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CriterionScoreItemDto)
  scores: CriterionScoreItemDto[];
}

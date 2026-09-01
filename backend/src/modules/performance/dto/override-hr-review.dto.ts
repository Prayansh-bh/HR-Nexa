import {
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CriterionScoreItemDto } from './criterion-score-item.dto';

export class OverrideHrReviewDto {
  @IsString()
  @IsOptional()
  @MaxLength(2000)
  remarks?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CriterionScoreItemDto)
  scores: CriterionScoreItemDto[];
}

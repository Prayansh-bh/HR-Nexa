import {
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CriterionScoreItemDto } from './criterion-score-item.dto';

export class SubmitManagerReviewDto {
  @IsString()
  @IsOptional()
  @MaxLength(2000)
  feedback?: string;

  @IsBoolean()
  @IsOptional()
  promotion?: boolean;

  @IsBoolean()
  @IsOptional()
  increment?: boolean;

  @IsBoolean()
  @IsOptional()
  training?: boolean;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CriterionScoreItemDto)
  scores: CriterionScoreItemDto[];
}

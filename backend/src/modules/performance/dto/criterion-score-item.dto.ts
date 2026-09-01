import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CriterionScoreItemDto {
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  criterionId: string;

  @IsNumber()
  @Min(0, { message: 'Score must be at least 0.0' })
  @Max(5, { message: 'Score cannot exceed 5.0' })
  score: number;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  remarks?: string;
}

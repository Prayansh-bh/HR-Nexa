import {
  IsArray,
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateReviewCycleDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  description?: string;

  @IsString()
  @IsOptional()
  @IsIn(['Quarterly', 'Semi-Annual', 'Annual', 'Monthly', 'Ad-hoc'])
  reviewType?: string;

  @IsDateString()
  @IsNotEmpty()
  startDate: string;

  @IsDateString()
  @IsNotEmpty()
  endDate: string;

  @IsDateString()
  @IsNotEmpty()
  deadline: string;

  @IsString()
  @IsOptional()
  @IsIn(['Draft', 'Scheduled', 'Active', 'Completed', 'Archived', 'Cancelled'])
  status?: string;

  @IsString()
  @IsOptional()
  @IsIn(['ALL', 'SELECTED'])
  participantScope?: 'ALL' | 'SELECTED';

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  participantIds?: string[];

  @IsString()
  @IsOptional()
  companyId?: string;
}

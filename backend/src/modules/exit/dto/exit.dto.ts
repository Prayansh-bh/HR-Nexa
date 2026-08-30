import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsDateString,
} from 'class-validator';

export class SubmitResignationDto {
  @IsString()
  @IsNotEmpty()
  reason: string;

  @IsDateString()
  @IsNotEmpty()
  proposedLastWorkingDay: string;

  @IsBoolean()
  @IsOptional()
  noticeBuyoutRequest?: boolean;

  @IsString()
  @IsOptional()
  additionalComments?: string;
}

export class ApproveExitDto {
  @IsDateString()
  @IsNotEmpty()
  approvedLastWorkingDay: string;

  @IsDateString()
  @IsOptional()
  noticeStartDate?: string;

  @IsDateString()
  @IsOptional()
  noticeEndDate?: string;

  @IsString()
  @IsOptional()
  remarks?: string;
}

export class RejectExitDto {
  @IsString()
  @IsNotEmpty()
  remarks: string;
}

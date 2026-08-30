import { IsString, IsNotEmpty, IsOptional, IsEnum, IsInt, Min, IsArray, ValidateNested, Matches, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';

export enum DPRTaskStatus {
  COMPLETED = 'COMPLETED',
  IN_PROGRESS = 'IN_PROGRESS',
  BLOCKED = 'BLOCKED',
}

export class CreateDprTaskDto {
  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsString()
  @IsOptional()
  @MaxLength(2000, { message: 'Description must be 2000 characters or less' })
  description?: string;

  @IsEnum(DPRTaskStatus)
  @IsNotEmpty()
  status!: DPRTaskStatus;

  @IsInt()
  @Min(0, { message: 'Minutes spent must be at least 0' })
  minutesSpent!: number;
}

export class CreateDprDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'reportDate must be in YYYY-MM-DD format' })
  reportDate!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000, { message: 'Summary must be 2000 characters or less' })
  summary!: string;

  @IsString()
  @IsOptional()
  @MaxLength(2000, { message: 'Blockers must be 2000 characters or less' })
  blockers?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateDprTaskDto)
  tasks!: CreateDprTaskDto[];
}

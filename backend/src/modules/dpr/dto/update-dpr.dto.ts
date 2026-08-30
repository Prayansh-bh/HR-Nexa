import { IsString, IsNotEmpty, IsOptional, IsArray, ValidateNested, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';
import { CreateDprTaskDto } from './create-dpr.dto';

export class UpdateDprDto {
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

import { IsString, IsOptional, MaxLength } from 'class-validator';

export class UpdateCompanyProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  company?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  gst?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  pan?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  cin?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  contact?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  hrAdmin?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  ownerName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  ownerEmail?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  billing?: string;
}

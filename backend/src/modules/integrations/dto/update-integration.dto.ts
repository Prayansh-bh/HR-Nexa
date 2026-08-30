import { IsObject, IsOptional, IsString } from 'class-validator';

export class UpdateIntegrationCredentialApiDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsObject()
  config?: Record<string, any>;

  @IsOptional()
  @IsObject()
  secrets?: Record<string, any>;
}

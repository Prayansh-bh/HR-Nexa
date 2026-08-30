import { IsEnum, IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';
import { IntegrationProvider } from '../types/integration.types';

export class CreateIntegrationCredentialApiDto {
  @IsEnum(IntegrationProvider)
  @IsNotEmpty()
  provider: IntegrationProvider;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsObject()
  @IsNotEmpty()
  config: Record<string, any>;

  @IsOptional()
  @IsObject()
  secrets?: Record<string, any>;
}

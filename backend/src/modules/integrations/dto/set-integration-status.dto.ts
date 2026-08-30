import { IsBoolean, IsNotEmpty } from 'class-validator';

export class SetIntegrationStatusApiDto {
  @IsBoolean()
  @IsNotEmpty()
  enabled: boolean;
}

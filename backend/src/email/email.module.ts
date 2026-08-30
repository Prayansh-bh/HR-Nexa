import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EmailService } from './email.service';
import { IntegrationsModule } from '../modules/integrations/integrations.module';

@Global()
@Module({
  imports: [ConfigModule, IntegrationsModule],
  providers: [EmailService],
  exports: [EmailService],
})
export class EmailModule {}

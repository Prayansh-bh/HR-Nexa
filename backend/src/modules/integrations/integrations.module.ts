import { Module } from '@nestjs/common';
import { SecurityModule } from '../../common/security/security.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuditModule } from '../../common/audit/audit.module';
import { IntegrationCredentialsService } from './services/integration-credentials.service';
import { IntegrationResolverService } from './services/integration-resolver.service';
import { IntegrationsController } from './controllers/integrations.controller';

@Module({
  imports: [SecurityModule, PrismaModule, AuditModule],
  controllers: [IntegrationsController],
  providers: [IntegrationCredentialsService, IntegrationResolverService],
  exports: [SecurityModule, IntegrationCredentialsService, IntegrationResolverService],
})
export class IntegrationsModule {}

import { Module } from '@nestjs/common';
import { SystemService } from './services/system.service';
import { SystemConfigService } from './services/system-config.service';
import { SystemController } from './controllers/system.controller';
import { NotificationsModule } from '../notifications/notifications.module';
import { PrismaModule } from '../../prisma/prisma.module';

import { AuditLogsRepository } from './repositories/audit-logs.repository';
import { SystemConfigRepository } from './repositories/system-config.repository';

@Module({
  imports: [NotificationsModule, PrismaModule],
  controllers: [SystemController],
  providers: [
    SystemService,
    SystemConfigService,
    AuditLogsRepository,
    SystemConfigRepository,
  ],
  exports: [
    SystemService,
    SystemConfigService,
    AuditLogsRepository,
    SystemConfigRepository,
  ],
})
export class SystemModule {}

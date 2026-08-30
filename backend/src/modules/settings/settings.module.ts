import { Module } from '@nestjs/common';
import { SettingsController } from './controllers/settings.controller';
import { SettingsService } from './services/settings.service';
import { FiscalYearController } from './controllers/fiscal-year.controller';
import { FiscalYearService } from './services/fiscal-year.service';
import { FiscalYearRepository } from './repositories/fiscal-year.repository';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuditModule } from '../../common/audit/audit.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [PrismaModule, AuditModule, NotificationsModule],
  controllers: [SettingsController, FiscalYearController],
  providers: [SettingsService, FiscalYearService, FiscalYearRepository],
  exports: [SettingsService, FiscalYearService, FiscalYearRepository],
})
export class SettingsModule {}

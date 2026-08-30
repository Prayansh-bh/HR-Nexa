import { Module } from '@nestjs/common';
import { DashboardController } from './controllers/dashboard.controller';
import { SuperAdminDashboardController } from './controllers/super-admin-dashboard.controller';
import { DashboardService } from './services/dashboard.service';
import { DashboardRepository } from './repositories/dashboard.repository';

import { ReportsModule } from '../reports/reports.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { TicketsModule } from '../tickets/tickets.module';
import { SystemModule } from '../system/system.module';

@Module({
  imports: [ReportsModule, SubscriptionsModule, TicketsModule, SystemModule],
  controllers: [DashboardController, SuperAdminDashboardController],
  providers: [DashboardService, DashboardRepository],
  exports: [DashboardService, DashboardRepository],
})
export class DashboardModule {}

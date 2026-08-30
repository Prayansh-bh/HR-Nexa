import { Module, forwardRef } from '@nestjs/common';
import { SubscriptionsController } from './controllers/subscriptions.controller';
import { SubscriptionsRealtimeController } from './controllers/subscriptions-realtime.controller';
import { SubscriptionsService } from './services/subscriptions.service';
import { SubscriptionProvisioningService } from './services/subscription-provisioning.service';
import { SubscriptionLifecycleService } from './services/subscription-lifecycle.service';
import { SubscriptionBillingService } from './services/subscription-billing.service';
import { SubscriptionDashboardService } from './services/subscription-dashboard.service';
import { SubscriptionUsageService } from './services/subscription-usage.service';
import { SubscriptionCouponService } from './services/subscription-coupon.service';
import { SeatLimitService } from './services/seat-limit.service';
import { EmployeeCountSyncService } from './services/employee-count-sync.service';
import { SubscriptionsRepository } from './repositories/subscriptions.repository';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { CompanyNotificationsService } from '../../common/notifications/company-notifications.service';
import { AuditModule } from '../../common/audit/audit.module';
import { HealthModule } from './health/health.module';
import { SystemModule } from '../system/system.module';

import { SseTicketService } from './services/sse-ticket.service';

@Module({
  imports: [PrismaModule, AuditModule, SystemModule, forwardRef(() => AuthModule), forwardRef(() => HealthModule)],
  controllers: [SubscriptionsController, SubscriptionsRealtimeController],
  providers: [
    SubscriptionsService,
    SubscriptionProvisioningService,
    SubscriptionLifecycleService,
    SubscriptionBillingService,
    SubscriptionDashboardService,
    SubscriptionUsageService,
    SubscriptionCouponService,
    SeatLimitService,
    EmployeeCountSyncService,
    SubscriptionsRepository,
    CompanyNotificationsService,
    SseTicketService,
  ],
  exports: [
    SubscriptionsService,
    SubscriptionProvisioningService,
    SubscriptionLifecycleService,
    SubscriptionBillingService,
    SubscriptionDashboardService,
    SubscriptionUsageService,
    SubscriptionCouponService,
    SeatLimitService,
    EmployeeCountSyncService,
    SubscriptionsRepository,
    SseTicketService,
  ],
})
export class SubscriptionsModule {}

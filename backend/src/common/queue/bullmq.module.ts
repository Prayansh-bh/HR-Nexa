import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TenantModule } from '../tenant/tenant.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { BullMQQueueService } from './bullmq.queue.service';
import { BullMQWorkerSecurityService } from './bullmq.worker.security';
import { AsyncActorValidatorService } from './async-actor.validator';
import { PayrollWorker } from './workers/payroll.worker';
import { EmailWorker } from './workers/email.worker';
import { NotificationWorker } from './workers/notification.worker';
import { ReportWorker } from './workers/report.worker';
import { AttendanceSyncWorker } from './workers/attendance-sync.worker';
import { EmployeeSyncWorker } from './workers/employee-sync.worker';

import { OutboxBullMQBridge } from './outbox-bullmq.bridge';
import { BullMQObservabilityService } from './bullmq.observability.service';
import { BullMQDLQService } from './bullmq.dlq.service';
import { OutboxPublisherService } from './outbox-publisher.service';

@Global()
@Module({
  imports: [ConfigModule, TenantModule, PrismaModule],
  providers: [
    BullMQQueueService,
    BullMQWorkerSecurityService,
    AsyncActorValidatorService,
    OutboxBullMQBridge,
    BullMQObservabilityService,
    BullMQDLQService,
    OutboxPublisherService,
    PayrollWorker,
    EmailWorker,
    NotificationWorker,
    ReportWorker,
    AttendanceSyncWorker,
    EmployeeSyncWorker,
  ],
  exports: [
    BullMQQueueService,
    BullMQWorkerSecurityService,
    OutboxBullMQBridge,
    BullMQObservabilityService,
    BullMQDLQService,
    OutboxPublisherService,
    PayrollWorker,
    EmailWorker,
    NotificationWorker,
    ReportWorker,
    AttendanceSyncWorker,
    EmployeeSyncWorker,
  ],
})
export class BullMQModule {}

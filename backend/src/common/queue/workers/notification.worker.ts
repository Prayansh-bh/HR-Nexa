import { Injectable, Logger, OnModuleInit, OnModuleDestroy, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Worker, Job } from 'bullmq';
import { QUEUE_NAMES } from '../bullmq.constants';
import { getRedisConnectionOptions } from '../bullmq.config';
import { BullMQWorkerSecurityService } from '../bullmq.worker.security';
import { BullMQDLQService } from '../bullmq.dlq.service';
import { NotificationJobPayload } from '../bullmq.queue.service';
import { CompanyNotificationsService } from '../../notifications/company-notifications.service';

@Injectable()
export class NotificationWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationWorker.name);
  readonly workerId = `worker-notif-${process.pid || 1}`;
  private worker?: Worker;

  constructor(
    private readonly securityService: BullMQWorkerSecurityService,
    @Optional() private readonly notificationsService?: CompanyNotificationsService,
    @Optional() private readonly configService?: ConfigService,
    @Optional() private readonly dlqService?: BullMQDLQService,
  ) {}

  async onModuleInit() {
    const isEnabled = this.configService
      ? this.configService.get('ENABLE_QUEUE_WORKERS') !== false &&
        this.configService.get('ENABLE_QUEUE_WORKERS') !== 'false'
      : true;

    if (!isEnabled) {
      this.logger.log(`[WorkerDisabled] NotificationWorker is disabled via ENABLE_QUEUE_WORKERS=false`);
      return;
    }

    const connection = getRedisConnectionOptions(this.configService);
    this.worker = new Worker<NotificationJobPayload>(
      QUEUE_NAMES.NOTIFICATION,
      async (job: Job) => {
        return this.securityService.processSecureJob<NotificationJobPayload>(
          job,
          async (context) => {
            this.logger.log(`Executing notification job ${context.jobId} for target ${context.data.targetUser}`);

            if (this.notificationsService) {
              await this.notificationsService.notifySuperAdmin({
                title: context.data.title,
                message: context.data.content,
                company: context.companyId,
              });
            }

            return {
              status: 'COMPLETED',
              jobId: context.jobId,
              eventId: context.eventId,
              targetUser: context.data.targetUser,
            };
          },
          this.workerId,
        );
      },
      {
        connection,
        concurrency: 5,
      },
    );

    this.worker.on('error', (err: any) => {
      this.logger.debug(`[NotificationWorker] Worker connection error: ${err?.message || err}`);
    });

    this.worker.on('failed', async (job, err) => {
      this.logger.error(`Notification worker job ${job?.id} failed: ${err.message}`);
      if (job && this.dlqService && (err?.name === 'UnrecoverableError' || err?.message?.includes('PermanentSecurityFailure') || (job.attemptsMade || 1) >= 5)) {
        try {
          await this.dlqService.moveToDLQ(job, err, this.workerId);
        } catch (dlqErr: any) {
          this.logger.error(`Failed to move job ${job.id} to DLQ: ${dlqErr?.message}`);
        }
      }
    });
  }

  async onModuleDestroy() {
    if (this.worker) {
      await this.worker.close();
    }
  }
}

import { Injectable, Logger, OnModuleInit, OnModuleDestroy, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Worker, Job } from 'bullmq';
import { QUEUE_NAMES } from '../bullmq.constants';
import { getRedisConnectionOptions } from '../bullmq.config';
import { BullMQWorkerSecurityService } from '../bullmq.worker.security';
import { BullMQDLQService } from '../bullmq.dlq.service';
import { ReportJobPayload } from '../bullmq.queue.service';
import { PlatformReportsService } from '../../../modules/platform-reports/services/platform-reports.service';

@Injectable()
export class ReportWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ReportWorker.name);
  readonly workerId = `worker-report-${process.pid || 1}`;
  private worker?: Worker;

  constructor(
    private readonly securityService: BullMQWorkerSecurityService,
    @Optional() private readonly reportsService?: PlatformReportsService,
    @Optional() private readonly configService?: ConfigService,
    @Optional() private readonly dlqService?: BullMQDLQService,
  ) {}

  async onModuleInit() {
    const isEnabled = this.configService
      ? this.configService.get('ENABLE_QUEUE_WORKERS') !== false &&
        this.configService.get('ENABLE_QUEUE_WORKERS') !== 'false'
      : true;

    if (!isEnabled) {
      this.logger.log(`[WorkerDisabled] ReportWorker is disabled via ENABLE_QUEUE_WORKERS=false`);
      return;
    }

    const connection = getRedisConnectionOptions(this.configService);
    this.worker = new Worker<ReportJobPayload>(
      QUEUE_NAMES.REPORT,
      async (job: Job) => {
        return this.securityService.processSecureJob<ReportJobPayload>(
          job,
          async (context) => {
            this.logger.log(`Executing report job ${context.jobId} for report type ${context.data.reportType}`);

            if (this.reportsService) {
              await this.reportsService.generateReport(
                { reportType: context.data.reportType || 'EXECUTIVE_SUMMARY' } as any,
                { id: context.actorUserId, name: 'System Worker', role: context.actorRole },
              );
            }

            return {
              status: 'COMPLETED',
              jobId: context.jobId,
              eventId: context.eventId,
              reportType: context.data.reportType,
            };
          },
          this.workerId,
        );
      },
      {
        connection,
        concurrency: 2,
      },
    );

    this.worker.on('error', (err: any) => {
      this.logger.debug(`[ReportWorker] Worker connection error: ${err?.message || err}`);
    });

    this.worker.on('failed', async (job, err) => {
      this.logger.error(`Report worker job ${job?.id} failed: ${err.message}`);
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

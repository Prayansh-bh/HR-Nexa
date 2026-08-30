import { randomUUID } from 'crypto';
import { Injectable, Logger, OnModuleInit, OnModuleDestroy, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Worker, Job } from 'bullmq';
import { QUEUE_NAMES } from '../bullmq.constants';
import { getRedisConnectionOptions } from '../bullmq.config';
import { BullMQWorkerSecurityService } from '../bullmq.worker.security';
import { BullMQDLQService } from '../bullmq.dlq.service';
import { PayrollJobPayload } from '../bullmq.queue.service';
import { PayrollService } from '../../../modules/payroll/services/payroll.service';

@Injectable()
export class PayrollWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PayrollWorker.name);
  readonly workerId = `worker-payroll-${randomUUID()}`;
  private worker?: Worker;

  constructor(
    private readonly securityService: BullMQWorkerSecurityService,
    @Optional() private readonly payrollService?: PayrollService,
    @Optional() private readonly configService?: ConfigService,
    @Optional() private readonly dlqService?: BullMQDLQService,
  ) {}

  async onModuleInit() {
    const isEnabled = this.configService
      ? this.configService.get('ENABLE_QUEUE_WORKERS') !== false &&
        this.configService.get('ENABLE_QUEUE_WORKERS') !== 'false'
      : true;

    if (!isEnabled) {
      this.logger.log(`[WorkerDisabled] PayrollWorker is disabled via ENABLE_QUEUE_WORKERS=false`);
      return;
    }

    const connection = getRedisConnectionOptions(this.configService);
    this.worker = new Worker<PayrollJobPayload>(
      QUEUE_NAMES.PAYROLL,
      async (job: Job) => {
        return this.securityService.processSecureJob<PayrollJobPayload>(
          job,
          async (context) => {
            this.logger.log(`Executing payroll job ${context.jobId} for tenant ${context.companyId}`);

            if (this.payrollService) {
              const targetMonth = context.data.month || new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' });
              await this.payrollService.assertPeriodNotLocked(targetMonth);
            }

            return {
              status: 'COMPLETED',
              jobId: context.jobId,
              eventId: context.eventId,
              companyId: context.companyId,
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
      this.logger.debug(`[PayrollWorker] Worker connection error: ${err?.message || err}`);
    });

    this.worker.on('failed', async (job, err) => {
      this.logger.error(`Payroll worker job ${job?.id} failed: ${err.message}`);
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

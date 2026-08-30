import { Injectable, Logger, OnModuleInit, OnModuleDestroy, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Worker, Job } from 'bullmq';
import { QUEUE_NAMES } from '../bullmq.constants';
import { getRedisConnectionOptions } from '../bullmq.config';
import { BullMQWorkerSecurityService } from '../bullmq.worker.security';
import { BullMQDLQService } from '../bullmq.dlq.service';
import { EmployeeSyncJobPayload } from '../bullmq.queue.service';
import { EmployeeCountSyncService } from '../../../modules/subscriptions/services/employee-count-sync.service';

@Injectable()
export class EmployeeSyncWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EmployeeSyncWorker.name);
  readonly workerId = `worker-emp-${process.pid || 1}`;
  private worker?: Worker;

  constructor(
    private readonly securityService: BullMQWorkerSecurityService,
    @Optional() private readonly employeeSyncService?: EmployeeCountSyncService,
    @Optional() private readonly configService?: ConfigService,
    @Optional() private readonly dlqService?: BullMQDLQService,
  ) {}

  async onModuleInit() {
    const isEnabled = this.configService
      ? this.configService.get('ENABLE_QUEUE_WORKERS') !== false &&
        this.configService.get('ENABLE_QUEUE_WORKERS') !== 'false'
      : true;

    if (!isEnabled) {
      this.logger.log(`[WorkerDisabled] EmployeeSyncWorker is disabled via ENABLE_QUEUE_WORKERS=false`);
      return;
    }

    const connection = getRedisConnectionOptions(this.configService);
    this.worker = new Worker<EmployeeSyncJobPayload>(
      QUEUE_NAMES.EMPLOYEE_SYNC,
      async (job: Job) => {
        return this.securityService.processSecureJob<EmployeeSyncJobPayload>(
          job,
          async (context) => {
            this.logger.log(`Executing employee sync job ${context.jobId} for tenant ${context.companyId}`);

            if (this.employeeSyncService) {
              await this.employeeSyncService.syncCompany(
                context.companyId,
                context.data.reason || 'BullMQWorker',
              );
            }

            return {
              status: 'COMPLETED',
              jobId: context.jobId,
              eventId: context.eventId,
              reason: context.data.reason,
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
      this.logger.debug(`[EmployeeSyncWorker] Worker connection error: ${err?.message || err}`);
    });

    this.worker.on('failed', async (job, err) => {
      this.logger.error(`Employee sync worker job ${job?.id} failed: ${err.message}`);
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

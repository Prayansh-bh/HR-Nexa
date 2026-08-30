import { randomUUID } from 'crypto';
import { Injectable, Logger, OnModuleInit, OnModuleDestroy, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Worker, Job } from 'bullmq';
import { QUEUE_NAMES } from '../bullmq.constants';
import { getRedisConnectionOptions } from '../bullmq.config';
import { BullMQWorkerSecurityService } from '../bullmq.worker.security';
import { BullMQDLQService } from '../bullmq.dlq.service';
import { AttendanceSyncJobPayload } from '../bullmq.queue.service';
import { AttendanceService } from '../../../modules/attendance/services/attendance.service';

@Injectable()
export class AttendanceSyncWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AttendanceSyncWorker.name);
  readonly workerId = `worker-attendance-${randomUUID()}`;
  private worker?: Worker;

  constructor(
    private readonly securityService: BullMQWorkerSecurityService,
    @Optional() private readonly attendanceService?: AttendanceService,
    @Optional() private readonly configService?: ConfigService,
    @Optional() private readonly dlqService?: BullMQDLQService,
  ) {}

  async onModuleInit() {
    const isEnabled = this.configService
      ? this.configService.get('ENABLE_QUEUE_WORKERS') !== false &&
        this.configService.get('ENABLE_QUEUE_WORKERS') !== 'false'
      : true;

    if (!isEnabled) {
      this.logger.log(`[WorkerDisabled] AttendanceSyncWorker is disabled via ENABLE_QUEUE_WORKERS=false`);
      return;
    }

    const connection = getRedisConnectionOptions(this.configService);
    this.worker = new Worker<AttendanceSyncJobPayload>(
      QUEUE_NAMES.ATTENDANCE_SYNC,
      async (job: Job) => {
        return this.securityService.processSecureJob<AttendanceSyncJobPayload>(
          job,
          async (context) => {
            this.logger.log(`Executing attendance sync job ${context.jobId} for date ${context.data.syncDate}`);

            if (this.attendanceService) {
              const date = context.data.syncDate || new Date().toISOString().slice(0, 10);
              await this.attendanceService.findAll(
                { role: context.actorRole, companyId: context.companyId },
                undefined,
                date,
              );
            }

            return {
              status: 'COMPLETED',
              jobId: context.jobId,
              eventId: context.eventId,
              syncDate: context.data.syncDate,
            };
          },
          this.workerId,
        );
      },
      {
        connection,
        concurrency: 3,
      },
    );

    this.worker.on('error', (err: any) => {
      this.logger.debug(`[AttendanceSyncWorker] Worker connection error: ${err?.message || err}`);
    });

    this.worker.on('failed', async (job, err) => {
      this.logger.error(`Attendance sync worker job ${job?.id} failed: ${err.message}`);
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

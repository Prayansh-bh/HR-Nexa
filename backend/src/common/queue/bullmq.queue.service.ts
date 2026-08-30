import { Injectable, Logger, Optional, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue, JobsOptions } from 'bullmq';
import { CanonicalJobContext } from './canonical-job-context.interface';
import { validateCanonicalJobContext } from './async-job.validator';
import { QUEUE_NAMES, DLQ_NAMES, QueueName, DLQName, DEFAULT_BULLMQ_JOB_OPTIONS } from './bullmq.constants';
import { getRedisConnectionOptions } from './bullmq.config';

export interface PayrollJobPayload {
  periodId: string;
  companyId: string;
  month?: string;
  count?: number;
  userId?: string;
}

export interface EmailJobPayload {
  to: string;
  subject: string;
  body?: string;
  html?: string;
  template?: string;
}

export interface NotificationJobPayload {
  title: string;
  content: string;
  targetUser: string;
}

export interface ReportJobPayload {
  reportType: string;
  parameters?: Record<string, unknown>;
}

export interface AttendanceSyncJobPayload {
  syncDate: string;
  deviceId?: string;
}

export interface EmployeeSyncJobPayload {
  reason: string;
  delta?: number;
}

@Injectable()
export class BullMQQueueService implements OnModuleDestroy {
  private readonly logger = new Logger(BullMQQueueService.name);
  private readonly queueMap = new Map<string, Queue>();

  constructor(@Optional() private readonly configService?: ConfigService) {}

  /**
   * Lazily gets or initializes a BullMQ Queue instance for regular or DLQ queues.
   */
  getQueue(queueName: string): Queue {
    const validQueues = [
      ...Object.values(QUEUE_NAMES),
      ...Object.values(DLQ_NAMES),
    ] as string[];
    if (!validQueues.includes(queueName)) {
      throw new Error(`[BullMQQueueService] Invalid queue name: ${queueName}`);
    }

    if (!this.queueMap.has(queueName)) {
      const connection = getRedisConnectionOptions(this.configService);
      const queue = new Queue(queueName, {
        connection,
        defaultJobOptions: DEFAULT_BULLMQ_JOB_OPTIONS,
      });
      queue.on('error', (err: any) => {
        this.logger.debug(`[BullMQQueue:${queueName}] Suppressed connection error: ${err?.message || err}`);
      });
      this.queueMap.set(queueName, queue);
    }

    return this.queueMap.get(queueName)!;
  }

  /**
   * Enqueues a Dead Letter Queue record into the target DLQ using deterministic job ID.
   */
  async enqueueDLQ(
    dlqName: DLQName,
    payload: any,
    customOptions?: JobsOptions,
  ) {
    const queue = this.getQueue(dlqName);
    const jobOptions: JobsOptions = {
      removeOnComplete: 1000,
      removeOnFail: 1000,
      ...customOptions,
    };

    try {
      this.logger.warn(`Enqueuing DLQ record ${customOptions?.jobId || 'dlq-job'} into ${dlqName}`);
      const job = await queue.add(dlqName, payload, jobOptions);
      return job;
    } catch (err: any) {
      const safeErrorMsg = (err?.message || String(err)).replace(
        /(password=)[^&\s]+/gi,
        '$1[REDACTED]',
      );
      this.logger.error(`Failed to enqueue DLQ record into ${dlqName}: ${safeErrorMsg}`);
      throw new Error(`[BullMQQueueService] DLQ enqueue operational failure: ${safeErrorMsg}`);
    }
  }

  /**
   * Core generic job enqueue implementation with CanonicalJobContext validation and bounded retries.
   */
  async enqueue<T = unknown>(
    queueName: QueueName,
    context: CanonicalJobContext<T>,
    customOptions?: JobsOptions,
  ) {
    // 1. Validate Canonical Job Context
    const validatedContext = validateCanonicalJobContext<T>(context);

    // 2. Validate Queue Name
    const queue = this.getQueue(queueName);

    // 3. Merge job options (bounded retry defaults + deterministic jobId)
    const jobOptions: JobsOptions = {
      jobId: validatedContext.jobId,
      ...DEFAULT_BULLMQ_JOB_OPTIONS,
      ...customOptions,
    };

    try {
      this.logger.log(
        `Enqueuing BullMQ job ${validatedContext.jobId} into ${queueName} [Tenant: ${validatedContext.companyId}]`,
      );
      const job = await queue.add(queueName, validatedContext, jobOptions);
      return job;
    } catch (err: any) {
      const safeErrorMsg = (err?.message || String(err)).replace(
        /(password=)[^&\s]+/gi,
        '$1[REDACTED]',
      );
      this.logger.error(
        `Failed to enqueue job ${validatedContext.jobId} into ${queueName}: ${safeErrorMsg}`,
      );
      throw new Error(
        `[BullMQQueueService] Redis enqueue operational failure: ${safeErrorMsg}`,
      );
    }
  }

  async enqueuePayroll(context: CanonicalJobContext<PayrollJobPayload>, options?: JobsOptions) {
    return this.enqueue(QUEUE_NAMES.PAYROLL, context, options);
  }

  async enqueueEmail(context: CanonicalJobContext<EmailJobPayload>, options?: JobsOptions) {
    return this.enqueue(QUEUE_NAMES.EMAIL, context, options);
  }

  async enqueueNotification(context: CanonicalJobContext<NotificationJobPayload>, options?: JobsOptions) {
    return this.enqueue(QUEUE_NAMES.NOTIFICATION, context, options);
  }

  async enqueueReport(context: CanonicalJobContext<ReportJobPayload>, options?: JobsOptions) {
    return this.enqueue(QUEUE_NAMES.REPORT, context, options);
  }

  async enqueueAttendanceSync(context: CanonicalJobContext<AttendanceSyncJobPayload>, options?: JobsOptions) {
    return this.enqueue(QUEUE_NAMES.ATTENDANCE_SYNC, context, options);
  }

  async enqueueEmployeeSync(context: CanonicalJobContext<EmployeeSyncJobPayload>, options?: JobsOptions) {
    return this.enqueue(QUEUE_NAMES.EMPLOYEE_SYNC, context, options);
  }

  async onModuleDestroy() {
    for (const [name, queue] of this.queueMap.entries()) {
      try {
        await queue.close();
      } catch (err: any) {
        this.logger.warn(`Error closing BullMQ queue ${name}: ${err.message}`);
      }
    }
    this.queueMap.clear();
  }
}

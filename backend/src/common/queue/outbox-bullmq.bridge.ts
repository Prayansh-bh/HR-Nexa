import { Injectable, Logger } from '@nestjs/common';
import { BullMQQueueService } from './bullmq.queue.service';
import { AsyncActorValidatorService } from './async-actor.validator';
import { validateCanonicalJobContext } from './async-job.validator';
import { CanonicalJobContext } from './canonical-job-context.interface';
import { QUEUE_NAMES, QueueName } from './bullmq.constants';
import { OutboxEventRecord } from './outbox.processor';

export const EVENT_TO_QUEUE_MAP: Record<string, QueueName> = {
  // Payroll events
  PAYROLL_BATCH_PROCESSED: QUEUE_NAMES.PAYROLL,
  PAYROLL_CALCULATE: QUEUE_NAMES.PAYROLL,

  // Email events
  EMAIL_SEND: QUEUE_NAMES.EMAIL,
  EMAIL_DISPATCH: QUEUE_NAMES.EMAIL,
  SEND_EMAIL: QUEUE_NAMES.EMAIL,

  // Notification events
  NOTIFICATION_SEND: QUEUE_NAMES.NOTIFICATION,
  SYSTEM_NOTIFICATION: QUEUE_NAMES.NOTIFICATION,
  NOTIFY_USER: QUEUE_NAMES.NOTIFICATION,

  // Report events
  REPORT_GENERATE: QUEUE_NAMES.REPORT,
  GENERATE_REPORT: QUEUE_NAMES.REPORT,

  // Attendance events
  ATTENDANCE_SYNC: QUEUE_NAMES.ATTENDANCE_SYNC,
  SYNC_ATTENDANCE: QUEUE_NAMES.ATTENDANCE_SYNC,

  // Employee sync events
  EMPLOYEE_SYNC: QUEUE_NAMES.EMPLOYEE_SYNC,
  SYNC_EMPLOYEES: QUEUE_NAMES.EMPLOYEE_SYNC,
  EMPLOYEE_COUNT_RECONCILE: QUEUE_NAMES.EMPLOYEE_SYNC,
};

export interface BridgeDispatchResult {
  success: boolean;
  queueName: QueueName;
  jobId: string;
  context: CanonicalJobContext;
}

@Injectable()
export class OutboxBullMQBridge {
  private readonly logger = new Logger(OutboxBullMQBridge.name);

  constructor(
    private readonly bullMQQueueService: BullMQQueueService,
    private readonly actorValidator: AsyncActorValidatorService,
  ) {}

  /**
   * Resolves the target BullMQ queue name for a given Outbox eventType.
   * Throws an error (fails closed) if the eventType is unmapped.
   */
  resolveQueueName(eventType: string): QueueName {
    const queueName = EVENT_TO_QUEUE_MAP[eventType];
    if (!queueName) {
      throw new Error(`[OutboxBullMQBridge] Unmapped Outbox eventType "${eventType}". Fail-closed: dispatch aborted.`);
    }
    return queueName;
  }

  /**
   * Bridges a claimed OutboxEventRecord to a durable, deterministic BullMQ job.
   */
  async dispatch(event: OutboxEventRecord): Promise<BridgeDispatchResult> {
    // 1. Resolve queue name (fails closed if unmapped)
    const queueName = this.resolveQueueName(event.eventType);

    // 2. Parse and normalize payload into CanonicalJobContext
    let rawPayload: any = {};
    try {
      rawPayload = JSON.parse(event.payload || '{}');
    } catch {
      rawPayload = { rawText: event.payload };
    }

    const rawContext: Record<string, unknown> =
      rawPayload && typeof rawPayload === 'object' && 'jobId' in rawPayload
        ? rawPayload
        : {
            jobId: event.id,
            eventId: event.id,
            companyId: event.companyId || rawPayload.companyId || 'DEFAULT_COMPANY',
            actorUserId: rawPayload.userId || rawPayload.actorUserId || 'system',
            actorRole: rawPayload.userRole || rawPayload.actorRole || 'HRAdmin',
            executionScope: rawPayload.executionScope || (event.companyId === 'PLATFORM' ? 'PLATFORM' : 'TENANT'),
            correlationId: rawPayload.correlationId || event.id,
            enqueuedAt: event.createdAt ? new Date(event.createdAt).toISOString() : new Date().toISOString(),
            data: rawPayload,
          };

    // 3. Validate Canonical Context Structure
    const context = validateCanonicalJobContext(rawContext);

    // 4. Validate Actor Identity & Status
    await this.actorValidator.validateActor(context);

    // 5. Construct deterministic BullMQ-safe Job ID: outbox-${eventId}
    const deterministicJobId = `outbox-${context.eventId}`;

    // 6. Enqueue durable job to BullMQ
    await this.bullMQQueueService.enqueue(queueName, context, {
      jobId: deterministicJobId,
    });

    this.logger.log(
      `[OutboxBridgeSuccess] Event ${event.id} (${event.eventType}) -> BullMQ Queue ${queueName} with JobID ${deterministicJobId}`,
    );

    return {
      success: true,
      queueName,
      jobId: deterministicJobId,
      context,
    };
  }
}

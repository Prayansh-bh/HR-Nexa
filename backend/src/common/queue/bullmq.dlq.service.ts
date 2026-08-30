import { Injectable, Logger, Optional, UnauthorizedException } from '@nestjs/common';
import { Job } from 'bullmq';
import { BullMQQueueService } from './bullmq.queue.service';
import { BullMQObservabilityService } from './bullmq.observability.service';
import { QUEUE_TO_DLQ_MAP, DLQ_NAMES, QUEUE_NAMES, QueueName, DLQName } from './bullmq.constants';
import { CanonicalJobContext } from './canonical-job-context.interface';

export interface DLQRecordPayload<T = unknown> {
  originalQueue: string;
  originalJobId: string;
  eventId?: string;
  companyId?: string;
  actorUserId?: string;
  actorRole?: string;
  executionScope?: string;
  correlationId?: string;
  attemptCount: number;
  failedAt: string;
  sanitizedError: string;
  workerId: string;
  canonicalContext?: CanonicalJobContext<T>;
}

@Injectable()
export class BullMQDLQService {
  private readonly logger = new Logger(BullMQDLQService.name);

  constructor(
    private readonly queueService: BullMQQueueService,
    private readonly observabilityService: BullMQObservabilityService,
  ) {}

  /**
   * Resolves the target DLQ name for a given queue name.
   */
  getDLQName(queueName: string): DLQName {
    const dlqName = QUEUE_TO_DLQ_MAP[queueName as QueueName];
    if (!dlqName) {
      throw new Error(`[BullMQDLQService] No registered DLQ mapping for queue: ${queueName}`);
    }
    return dlqName;
  }

  /**
   * Resolves original Queue name from a DLQ name.
   */
  getOriginalQueueFromDLQ(dlqName: string): QueueName {
    const entry = Object.entries(QUEUE_TO_DLQ_MAP).find(([_, value]) => value === dlqName);
    if (!entry) {
      throw new Error(`[BullMQDLQService] Invalid DLQ name: ${dlqName}`);
    }
    return entry[0] as QueueName;
  }

  /**
   * Moves a permanently failed or max-retried job into its corresponding Dead Letter Queue.
   * Uses deterministic jobId `dlq:${queueName}:${job.id}` to guarantee idempotent DLQ entry.
   */
  async moveToDLQ(
    job: Job,
    error: Error | string,
    workerId: string,
  ): Promise<DLQRecordPayload> {
    const queueName = job.queueName;
    const dlqName = this.getDLQName(queueName);
    const rawData = job.data && typeof job.data === 'object' ? job.data : {};

    const context: Partial<CanonicalJobContext> = rawData;

    const rawError = typeof error === 'string' ? error : error?.message || String(error);
    const sanitizedError = this.observabilityService.sanitizeSecret(rawError);

    const dlqPayload: DLQRecordPayload = {
      originalQueue: queueName,
      originalJobId: String(job.id || context.jobId || 'unknown'),
      eventId: context.eventId || String(job.id || 'unknown'),
      companyId: context.companyId || 'N/A',
      actorUserId: context.actorUserId || 'system',
      actorRole: context.actorRole || 'N/A',
      executionScope: context.executionScope || 'N/A',
      correlationId: context.correlationId || String(job.id || 'unknown'),
      attemptCount: job.attemptsMade || 1,
      failedAt: new Date().toISOString(),
      sanitizedError,
      workerId,
      canonicalContext: context.jobId ? (context as CanonicalJobContext) : undefined,
    };

    const deterministicDlqJobId = `dlq-${queueName}-${job.id}`;

    // Enqueue into DLQ using deterministic job ID
    await this.queueService.enqueueDLQ(dlqName, dlqPayload, {
      jobId: deterministicDlqJobId,
    });

    this.observabilityService.logWorkerEvent({
      status: 'DLQ',
      jobId: String(job.id),
      eventId: context.eventId,
      queue: queueName,
      companyId: context.companyId,
      actorUserId: context.actorUserId,
      actorRole: context.actorRole,
      executionScope: context.executionScope,
      correlationId: context.correlationId,
      workerId,
      attempt: job.attemptsMade || 1,
      errorMessage: sanitizedError,
    });

    return dlqPayload;
  }

  /**
   * Replays a Dead Letter Queue job back into its primary queue.
   * Only SuperAdmin or SYSTEM actor is authorized.
   */
  async replayDLQJob(
    dlqName: DLQName | string,
    jobId: string,
    actor: { id: string; role: string },
  ): Promise<{ status: string; newJobId: string; originalQueue: string }> {
    // 1. Validate Actor Authorization (Database / Authenticated Role)
    const isSuperAdmin = actor.role === 'SuperAdmin' || actor.role === 'SUPER_ADMIN';
    const isSystem = actor.id === 'SYSTEM' || actor.role === 'SYSTEM';

    if (!isSuperAdmin && !isSystem) {
      throw new UnauthorizedException(
        `[DLQReplay] Unauthorized: Only SuperAdmin or SYSTEM can replay DLQ jobs (Actor: ${actor.id}, Role: ${actor.role})`,
      );
    }

    // 2. Validate DLQ Name and Resolve Original Queue Name
    const validDLQs = Object.values(DLQ_NAMES) as string[];
    if (!validDLQs.includes(dlqName)) {
      throw new Error(`[DLQReplay] Invalid DLQ name: ${dlqName}`);
    }

    const originalQueue = this.getOriginalQueueFromDLQ(dlqName);

    // 3. Fetch Job from DLQ Queue
    const dlqQueue = this.queueService.getQueue(dlqName);
    const job = await dlqQueue.getJob(jobId);

    if (!job) {
      throw new Error(`[DLQReplay] Job ${jobId} not found in ${dlqName}`);
    }

    const payload: DLQRecordPayload = job.data;

    // 4. Reconstruct Canonical Context preserving original identifiers
    const context: CanonicalJobContext = payload.canonicalContext || {
      jobId: payload.originalJobId,
      eventId: payload.eventId || payload.originalJobId,
      companyId: payload.companyId || 'N/A',
      actorUserId: payload.actorUserId || 'system',
      actorRole: payload.actorRole || 'N/A',
      executionScope: (payload.executionScope as any) || 'TENANT',
      correlationId: payload.correlationId || payload.originalJobId,
      enqueuedAt: new Date().toISOString(),
      data: {},
    };

    const deterministicReplayJobId = `replay-${dlqName}-${jobId}`;

    // 5. Enqueue into Primary Queue
    await this.queueService.enqueue(originalQueue, context, {
      jobId: deterministicReplayJobId,
    });

    // 6. Delete DLQ Job ONLY after successful enqueue confirmation
    try {
      await job.remove();
    } catch (removeErr: any) {
      this.logger.warn(
        `[DLQReplay] Job ${jobId} replayed to ${originalQueue} but failed to remove from ${dlqName}: ${removeErr.message}`,
      );
    }

    this.logger.log(
      `[DLQReplay] SuperAdmin ${actor.id} replayed job ${jobId} from ${dlqName} to ${originalQueue} (New JobId: ${deterministicReplayJobId})`,
    );

    return {
      status: 'REPLAYED',
      newJobId: deterministicReplayJobId,
      originalQueue,
    };
  }

  /**
   * Safe inspection capability listing jobs in a DLQ.
   */
  async getDLQJobs(dlqName: DLQName | string, limit = 50) {
    const validDLQs = Object.values(DLQ_NAMES) as string[];
    if (!validDLQs.includes(dlqName)) {
      throw new Error(`[BullMQDLQService] Invalid DLQ name: ${dlqName}`);
    }

    const queue = this.queueService.getQueue(dlqName);
    const jobs = await queue.getJobs(['waiting', 'active', 'completed', 'failed', 'delayed'], 0, limit);

    return jobs.map((j) => ({
      id: j.id,
      originalQueue: j.data?.originalQueue || 'unknown',
      eventId: j.data?.eventId,
      companyId: j.data?.companyId,
      actorUserId: j.data?.actorUserId,
      actorRole: j.data?.actorRole,
      failedAt: j.data?.failedAt,
      sanitizedError: this.observabilityService.sanitizeSecret(j.data?.sanitizedError),
    }));
  }
}

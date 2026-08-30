import { Injectable, Logger, Optional } from '@nestjs/common';
import { Job, UnrecoverableError } from 'bullmq';
import { validateCanonicalJobContext, AsyncJobValidationError } from './async-job.validator';
import { AsyncActorValidatorService, AsyncActorRevokedException } from './async-actor.validator';
import { TenantContextService } from '../tenant/tenant-context.service';
import { CanonicalJobContext } from './canonical-job-context.interface';
import { BullMQObservabilityService } from './bullmq.observability.service';

@Injectable()
export class BullMQWorkerSecurityService {
  private readonly logger = new Logger(BullMQWorkerSecurityService.name);

  constructor(
    private readonly actorValidator: AsyncActorValidatorService,
    @Optional() private readonly observability?: BullMQObservabilityService,
  ) {}

  /**
   * Executes a BullMQ job inside the mandatory security pipeline:
   * 1. Validate CanonicalJobContext structure
   * 2. Validate Actor status & revocation via AsyncActorValidatorService
   * 3. Establish TenantContextService context (runTenant or runPlatform)
   * 4. Wrap security/validation errors in UnrecoverableError to stop retries
   */
  async processSecureJob<T, R = unknown>(
    job: Job,
    handler: (context: CanonicalJobContext<T>) => Promise<R>,
    workerIdParam = `worker-inst-${process.pid || 1}`,
  ): Promise<R> {
    const startTime = Date.now();
    let currentContext: CanonicalJobContext<T> | undefined;

    try {
      // 1. Validate Canonical Context
      currentContext = validateCanonicalJobContext<T>(job.data);

      if (this.observability) {
        this.observability.logWorkerEvent(
          this.observability.formatContextOptions(
            'STARTED',
            currentContext,
            workerIdParam,
            job.attemptsMade + 1,
            job.queueName,
          ),
        );
      }

      // 2. Validate Actor Identity & Status
      await this.actorValidator.validateActor(currentContext);

      // 3. Execute inside explicit Tenant Context boundary
      let result: R;

      if (currentContext.executionScope === 'TENANT') {
        result = await TenantContextService.runTenant(currentContext.companyId, async () => {
          return await handler(currentContext!);
        });
      } else if (currentContext.executionScope === 'PLATFORM') {
        result = await TenantContextService.runPlatform(async () => {
          return await handler(currentContext!);
        });
      } else {
        throw new AsyncJobValidationError(`Invalid executionScope: ${currentContext.executionScope}`);
      }

      const durationMs = Date.now() - startTime;

      if (this.observability) {
        this.observability.logWorkerEvent(
          this.observability.formatContextOptions(
            'COMPLETED',
            currentContext,
            workerIdParam,
            job.attemptsMade + 1,
            job.queueName,
            durationMs,
          ),
        );
      } else {
        this.logger.log(
          `[WorkerSuccess] Job ${currentContext.jobId} | Queue ${job.queueName} | Tenant ${currentContext.companyId} | Actor ${currentContext.actorUserId} | ${durationMs}ms`,
        );
      }

      return result;
    } catch (err: any) {
      const durationMs = Date.now() - startTime;
      const safeErrorMsg = this.observability
        ? this.observability.sanitizeSecret(err?.message || String(err))
        : (err?.message || String(err)).replace(/(password=)[^&\s]+/gi, '$1[REDACTED]');

      const isPermanentSecurity =
        err instanceof AsyncJobValidationError ||
        err instanceof AsyncActorRevokedException ||
        err.name === 'AsyncJobValidationError' ||
        err.name === 'AsyncActorRevokedException';

      const errorClass = isPermanentSecurity
        ? 'SECURITY_FAILURE'
        : job.attemptsMade + 1 >= 5
        ? 'PERMANENT_FAILURE'
        : 'TRANSIENT_FAILURE';

      if (this.observability && currentContext) {
        this.observability.logWorkerEvent(
          this.observability.formatContextOptions(
            isPermanentSecurity ? 'FAILED' : 'RETRYING',
            currentContext,
            workerIdParam,
            job.attemptsMade + 1,
            job.queueName,
            durationMs,
            errorClass,
            safeErrorMsg,
          ),
        );
      }

      // Permanent Security / Validation Failures -> Unrecoverable (No retries)
      if (isPermanentSecurity) {
        this.logger.error(
          `[WorkerPermanentSecurityFailure] Job ${job.id} | Queue ${job.queueName} | Reason: ${safeErrorMsg} | Duration: ${durationMs}ms`,
        );
        throw new UnrecoverableError(`[PermanentSecurityFailure] ${safeErrorMsg}`);
      }

      // Operational / Transient Failures -> Allowed to retry via BullMQ backoff
      this.logger.warn(
        `[WorkerTransientFailure] Job ${job.id} | Queue ${job.queueName} | Reason: ${safeErrorMsg} | Duration: ${durationMs}ms`,
      );
      throw err;
    }
  }
}

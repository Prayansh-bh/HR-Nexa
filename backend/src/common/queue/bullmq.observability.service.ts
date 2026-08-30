import { Injectable, Logger } from '@nestjs/common';
import { CanonicalJobContext } from './canonical-job-context.interface';

export type WorkerExecutionStatus = 'STARTED' | 'COMPLETED' | 'RETRYING' | 'FAILED' | 'DLQ';
export type ErrorClassification = 'SECURITY_FAILURE' | 'PERMANENT_FAILURE' | 'TRANSIENT_FAILURE';

export interface StructuredWorkerLogOptions {
  status: WorkerExecutionStatus;
  jobId: string;
  eventId?: string;
  queue: string;
  jobName?: string;
  companyId?: string;
  actorUserId?: string;
  actorRole?: string;
  executionScope?: string;
  correlationId?: string;
  workerId: string;
  attempt: number;
  maxAttempts?: number;
  durationMs?: number;
  errorClassification?: ErrorClassification;
  errorMessage?: string;
}

@Injectable()
export class BullMQObservabilityService {
  private readonly logger = new Logger('WorkerObservability');

  /**
   * Redacts sensitive parameters, tokens, credentials, and passwords from log strings.
   */
  sanitizeSecret(input?: string): string {
    if (!input) return '';
    return input
      .replace(/(password=)[^&\s]+/gi, '$1[REDACTED]')
      .replace(/(token=)[^&\s]+/gi, '$1[REDACTED]')
      .replace(/(secret=)[^&\s]+/gi, '$1[REDACTED]')
      .replace(/(apiKey=)[^&\s]+/gi, '$1[REDACTED]')
      .replace(/(Bearer\s+)[A-Za-z0-9\-\._~\+\/]+=*/gi, '$1[REDACTED]')
      .replace(/(postgres:\/\/[:\w]+:)[^@]+(@)/gi, '$1[REDACTED]$2')
      .replace(/(redis:\/\/[:\w]+:)[^@]+(@)/gi, '$1[REDACTED]$2');
  }

  /**
   * Emits a structured log line adhering to standard observability guidelines.
   */
  logWorkerEvent(opts: StructuredWorkerLogOptions): void {
    const sanitizedError = this.sanitizeSecret(opts.errorMessage);
    const eventId = opts.eventId || 'N/A';
    const companyId = opts.companyId || 'N/A';
    const actor = opts.actorUserId || 'N/A';
    const correlationId = opts.correlationId || 'N/A';
    const durationStr = opts.durationMs !== undefined ? `${opts.durationMs}ms` : '0ms';
    const errorStr = sanitizedError ? ` | error=${sanitizedError}` : '';
    const classStr = opts.errorClassification ? ` | class=${opts.errorClassification}` : '';
    const attemptStr = opts.maxAttempts ? `${opts.attempt}/${opts.maxAttempts}` : `${opts.attempt}`;

    const logLine = `[WorkerLog] status=${opts.status} | jobId=${opts.jobId} | eventId=${eventId} | queue=${opts.queue} | companyId=${companyId} | actor=${actor} | scope=${opts.executionScope || 'N/A'} | correlationId=${correlationId} | workerId=${opts.workerId} | attempt=${attemptStr} | duration=${durationStr}${classStr}${errorStr}`;

    if (opts.status === 'FAILED' || opts.status === 'DLQ') {
      this.logger.error(logLine);
    } else if (opts.status === 'RETRYING') {
      this.logger.warn(logLine);
    } else {
      this.logger.log(logLine);
    }
  }

  /**
   * Helper to format CanonicalJobContext into log options.
   */
  formatContextOptions(
    status: WorkerExecutionStatus,
    context: CanonicalJobContext<any>,
    workerId: string,
    attempt: number,
    queueName: string,
    durationMs?: number,
    errorClassification?: ErrorClassification,
    errorMessage?: string,
  ): StructuredWorkerLogOptions {
    return {
      status,
      jobId: context.jobId,
      eventId: context.eventId,
      queue: queueName,
      companyId: context.companyId,
      actorUserId: context.actorUserId,
      actorRole: context.actorRole,
      executionScope: context.executionScope,
      correlationId: context.correlationId,
      workerId,
      attempt,
      maxAttempts: 5,
      durationMs,
      errorClassification,
      errorMessage,
    };
  }
}

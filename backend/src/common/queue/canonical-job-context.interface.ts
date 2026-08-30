export type ExecutionScope = 'TENANT' | 'PLATFORM';

export interface CanonicalJobContext<T = unknown> {
  /** Unique job execution identifier */
  jobId: string;

  /** Original OutboxEvent UUID if originated from database outbox */
  eventId?: string;

  /** Primary Tenant Identifier (UUID) — Mandatory when executionScope === 'TENANT' */
  companyId: string;

  /** Linked Subscription Identifier (UUID) */
  subscriptionId?: string;

  /** User ID of original actor who triggered the job ('SYSTEM' for background crons) */
  actorUserId: string;

  /** Role of original actor (e.g. 'HRAdmin', 'SuperAdmin', 'SYSTEM') */
  actorRole: string;

  /** Explicit boundary flag: 'TENANT' or 'PLATFORM' */
  executionScope: ExecutionScope;

  /** End-to-end tracing correlation ID */
  correlationId: string;

  /** ISO timestamp when job was enqueued */
  enqueuedAt: string;

  /** Feature-specific job data payload */
  data: T;
}

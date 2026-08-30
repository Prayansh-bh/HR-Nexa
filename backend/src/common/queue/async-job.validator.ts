import { CanonicalJobContext, ExecutionScope } from './canonical-job-context.interface';
import { PLATFORM_TENANT } from '../tenant/tenant-context.service';

export class AsyncJobValidationError extends Error {
  constructor(message: string) {
    super(`[AsyncJobValidationError] ${message}`);
    this.name = 'AsyncJobValidationError';
  }
}

export function validateCanonicalJobContext<T = unknown>(
  input: unknown,
): CanonicalJobContext<T> {
  if (!input || typeof input !== 'object') {
    throw new AsyncJobValidationError('Job context must be a non-null object');
  }

  const raw = input as Record<string, unknown>;

  // 1. jobId
  if (typeof raw.jobId !== 'string' || raw.jobId.trim().length === 0) {
    throw new AsyncJobValidationError('jobId is required and must be a non-empty string');
  }

  // 2. actorUserId
  if (typeof raw.actorUserId !== 'string' || raw.actorUserId.trim().length === 0) {
    throw new AsyncJobValidationError('actorUserId is required and must be a non-empty string');
  }

  // 3. actorRole
  if (typeof raw.actorRole !== 'string' || raw.actorRole.trim().length === 0) {
    throw new AsyncJobValidationError('actorRole is required and must be a non-empty string');
  }

  // 4. executionScope
  const scope = raw.executionScope as ExecutionScope;
  if (scope !== 'TENANT' && scope !== 'PLATFORM') {
    throw new AsyncJobValidationError('executionScope must be either "TENANT" or "PLATFORM"');
  }

  // 5. TENANT scope validation
  const companyId = typeof raw.companyId === 'string' ? raw.companyId.trim() : '';

  if (scope === 'TENANT') {
    if (!companyId) {
      throw new AsyncJobValidationError('TENANT jobs require a non-empty companyId');
    }
    if (companyId === PLATFORM_TENANT) {
      throw new AsyncJobValidationError('TENANT jobs cannot use PLATFORM as companyId');
    }
  }

  // 6. PLATFORM scope validation
  if (scope === 'PLATFORM') {
    if (raw.executionScope !== 'PLATFORM') {
      throw new AsyncJobValidationError('PLATFORM jobs must explicitly declare executionScope === "PLATFORM"');
    }
  }

  // 7. correlationId
  if (typeof raw.correlationId !== 'string' || raw.correlationId.trim().length === 0) {
    throw new AsyncJobValidationError('correlationId is required and must be a non-empty string');
  }

  // 8. enqueuedAt
  if (typeof raw.enqueuedAt !== 'string' || raw.enqueuedAt.trim().length === 0) {
    throw new AsyncJobValidationError('enqueuedAt is required and must be a valid ISO string');
  }
  const dateNum = Date.parse(raw.enqueuedAt);
  if (isNaN(dateNum)) {
    throw new AsyncJobValidationError('enqueuedAt must be a valid ISO date timestamp');
  }

  // 9. subscriptionId (optional check)
  if (raw.subscriptionId !== undefined && raw.subscriptionId !== null) {
    if (typeof raw.subscriptionId !== 'string' || raw.subscriptionId.trim().length === 0) {
      throw new AsyncJobValidationError('subscriptionId, when present, must be a non-empty string');
    }
  }

  // 10. eventId (optional check)
  if (raw.eventId !== undefined && raw.eventId !== null) {
    if (typeof raw.eventId !== 'string' || raw.eventId.trim().length === 0) {
      throw new AsyncJobValidationError('eventId, when present, must be a non-empty string');
    }
  }

  return {
    jobId: raw.jobId as string,
    eventId: raw.eventId as string | undefined,
    companyId: scope === 'PLATFORM' ? PLATFORM_TENANT : companyId,
    subscriptionId: raw.subscriptionId as string | undefined,
    actorUserId: raw.actorUserId as string,
    actorRole: raw.actorRole as string,
    executionScope: scope,
    correlationId: raw.correlationId as string,
    enqueuedAt: raw.enqueuedAt as string,
    data: (raw.data ?? {}) as T,
  };
}

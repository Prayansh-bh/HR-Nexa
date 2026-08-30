import { Test, TestingModule } from '@nestjs/testing';
import { OutboxBullMQBridge } from './outbox-bullmq.bridge';
import { BullMQQueueService } from './bullmq.queue.service';
import { AsyncActorValidatorService } from './async-actor.validator';
import { QUEUE_NAMES } from './bullmq.constants';

describe('OutboxBullMQBridge Job ID & Dispatch Spec', () => {
  let bridge: OutboxBullMQBridge;
  let queueService: jest.Mocked<BullMQQueueService>;
  let actorValidator: jest.Mocked<AsyncActorValidatorService>;

  beforeEach(async () => {
    queueService = {
      enqueue: jest.fn().mockResolvedValue({ id: 'job-1' }),
    } as any;

    actorValidator = {
      validateActor: jest.fn().mockResolvedValue(true),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OutboxBullMQBridge,
        { provide: BullMQQueueService, useValue: queueService },
        { provide: AsyncActorValidatorService, useValue: actorValidator },
      ],
    }).compile();

    bridge = module.get<OutboxBullMQBridge>(OutboxBullMQBridge);
  });

  it('generates a BullMQ-safe deterministic job ID without any colons', async () => {
    const event = {
      id: 'event-uuid-123',
      eventType: 'EMAIL_SEND',
      companyId: 'company-uuid-1',
      payload: JSON.stringify({
        jobId: 'job-1',
        eventId: 'event-uuid-123',
        companyId: 'company-uuid-1',
        actorUserId: 'user-1',
        actorRole: 'HRAdmin',
        executionScope: 'TENANT',
        correlationId: 'corr-1',
        enqueuedAt: new Date().toISOString(),
        data: { to: 'test@domain.com', subject: 'Test' },
      }),
      status: 'PENDING',
      attempts: 0,
      error: null,
      processingOwner: null,
      leaseExpiresAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await bridge.dispatch(event);

    expect(result.success).toBe(true);
    expect(result.queueName).toBe(QUEUE_NAMES.EMAIL);
    expect(result.jobId).toBe('outbox-event-uuid-123');
    expect(result.jobId).not.toContain(':'); // BullMQ restriction compliance
    expect(queueService.enqueue).toHaveBeenCalledWith(
      QUEUE_NAMES.EMAIL,
      expect.anything(),
      { jobId: 'outbox-event-uuid-123' },
    );
  });

  it('retrying the same event produces the exact same deterministic job ID', async () => {
    const event = {
      id: 'event-uuid-999',
      eventType: 'EMAIL_SEND',
      companyId: 'company-uuid-1',
      payload: JSON.stringify({
        jobId: 'job-999',
        eventId: 'event-uuid-999',
        companyId: 'company-uuid-1',
        actorUserId: 'user-1',
        actorRole: 'HRAdmin',
        executionScope: 'TENANT',
        correlationId: 'corr-999',
        enqueuedAt: new Date().toISOString(),
        data: { to: 'test@domain.com' },
      }),
      status: 'PENDING',
      attempts: 1,
      error: null,
      processingOwner: null,
      leaseExpiresAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result1 = await bridge.dispatch(event);
    const result2 = await bridge.dispatch(event);

    expect(result1.jobId).toBe('outbox-event-uuid-999');
    expect(result2.jobId).toBe('outbox-event-uuid-999');
    expect(result1.jobId).toBe(result2.jobId);
  });

  it('different events produce different deterministic job IDs to avoid collision', async () => {
    const eventA = {
      id: 'event-A',
      eventType: 'EMAIL_SEND',
      companyId: 'company-uuid-1',
      payload: JSON.stringify({
        jobId: 'job-A',
        eventId: 'event-A',
        companyId: 'company-uuid-1',
        actorUserId: 'user-1',
        actorRole: 'HRAdmin',
        executionScope: 'TENANT',
        correlationId: 'corr-A',
        enqueuedAt: new Date().toISOString(),
        data: { to: 'a@domain.com' },
      }),
      status: 'PENDING',
      attempts: 0,
      error: null,
      processingOwner: null,
      leaseExpiresAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const eventB = {
      id: 'event-B',
      eventType: 'EMAIL_SEND',
      companyId: 'company-uuid-1',
      payload: JSON.stringify({
        jobId: 'job-B',
        eventId: 'event-B',
        companyId: 'company-uuid-1',
        actorUserId: 'user-1',
        actorRole: 'HRAdmin',
        executionScope: 'TENANT',
        correlationId: 'corr-B',
        enqueuedAt: new Date().toISOString(),
        data: { to: 'b@domain.com' },
      }),
      status: 'PENDING',
      attempts: 0,
      error: null,
      processingOwner: null,
      leaseExpiresAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const resultA = await bridge.dispatch(eventA);
    const resultB = await bridge.dispatch(eventB);

    expect(resultA.jobId).toBe('outbox-event-A');
    expect(resultB.jobId).toBe('outbox-event-B');
    expect(resultA.jobId).not.toBe(resultB.jobId);
  });
});

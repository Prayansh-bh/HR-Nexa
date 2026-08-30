import { Test, TestingModule } from '@nestjs/testing';
import { OutboxProcessor } from './outbox.processor';
import { PrismaService } from '../../prisma/prisma.service';
import { QueueProcessor } from './queue.processor';
import { AsyncActorValidatorService } from './async-actor.validator';
import { OutboxBullMQBridge } from './outbox-bullmq.bridge';
import { EmailService } from '../../email/email.service';

describe('OutboxProcessor Spec', () => {
  let processor: OutboxProcessor;
  let prisma: any;
  let queueProcessor: jest.Mocked<QueueProcessor>;
  let actorValidator: jest.Mocked<AsyncActorValidatorService>;
  let bridge: jest.Mocked<OutboxBullMQBridge>;
  let emailService: jest.Mocked<EmailService>;

  const mockEmailEvent = {
    id: 'outbox-evt-1',
    eventType: 'EMAIL_SEND',
    companyId: 'company-uuid-1',
    payload: JSON.stringify({
      jobId: 'job-1',
      eventId: 'outbox-evt-1',
      companyId: 'company-uuid-1',
      actorUserId: 'user-1',
      actorRole: 'HRAdmin',
      executionScope: 'TENANT',
      correlationId: 'corr-1',
      enqueuedAt: new Date().toISOString(),
      data: {
        to: 'user@example.com',
        subject: 'Reset Your Password - HR NEXA',
        html: '<p>Reset link</p>',
      },
    }),
    status: 'PENDING',
    attempts: 0,
    error: null,
    processingOwner: null,
    leaseExpiresAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    queueProcessor = {
      processNotificationQueue: jest.fn(),
    } as any;

    actorValidator = {
      validateActor: jest.fn().mockResolvedValue(true),
    } as any;

    bridge = {
      dispatch: jest.fn().mockResolvedValue({ success: true }),
    } as any;

    emailService = {
      sendEmail: jest.fn().mockResolvedValue(true),
    } as any;

    prisma = {
      outboxEvent: {
        findMany: jest.fn(),
        update: jest.fn().mockResolvedValue({ id: 'outbox-evt-1' }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      outboxIdempotency: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      emailDelivery: {
        findUnique: jest.fn(),
        create: jest.fn().mockResolvedValue({ id: 'delivery-1', status: 'PENDING' }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        upsert: jest.fn().mockResolvedValue({ status: 'SENT' }),
      },
      $queryRaw: jest.fn().mockResolvedValue([mockEmailEvent]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OutboxProcessor,
        { provide: PrismaService, useValue: prisma },
        { provide: QueueProcessor, useValue: queueProcessor },
        { provide: AsyncActorValidatorService, useValue: actorValidator },
        { provide: EmailService, useValue: emailService },
        { provide: OutboxBullMQBridge, useValue: bridge },
      ],
    }).compile();

    processor = module.get<OutboxProcessor>(OutboxProcessor);
  });

  it('TEST 1: dispatches to BullMQ bridge when bridge is active and marks event PROCESSED', async () => {
    await processor.handleOutboxSweep();

    expect(bridge.dispatch).toHaveBeenCalledWith(mockEmailEvent);
    expect(prisma.outboxEvent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'outbox-evt-1' },
        data: expect.objectContaining({ status: 'PROCESSED' }),
      }),
    );
    expect(emailService.sendEmail).not.toHaveBeenCalled(); // Handled asynchronously by EmailWorker, not OutboxProcessor directly
  });

  it('TEST 2: falls back seamlessly to direct EmailService execution when bridge throws Redis connection error', async () => {
    bridge.dispatch.mockRejectedValueOnce(new Error('connect ECONNREFUSED 127.0.0.1:6379'));
    prisma.emailDelivery.findUnique.mockResolvedValue(null);

    await processor.handleOutboxSweep();

    expect(bridge.dispatch).toHaveBeenCalledTimes(1);
    expect(emailService.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'user@example.com',
        subject: 'Reset Your Password - HR NEXA',
        html: '<p>Reset link</p>',
        messageId: '<outbox-evt-1@hrnexa.com>',
      }),
    );
    expect(prisma.emailDelivery.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ eventId: 'outbox-evt-1' }),
        data: expect.objectContaining({ status: 'SENT' }),
      }),
    );
    expect(prisma.outboxEvent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'outbox-evt-1' },
        data: expect.objectContaining({ status: 'PROCESSED' }),
      }),
    );
  });

  it('TEST 3: leaves event PENDING and recoverable if SMTP send fails during fallback', async () => {
    bridge.dispatch.mockRejectedValueOnce(new Error('connect ECONNREFUSED 127.0.0.1:6379'));
    prisma.emailDelivery.findUnique.mockResolvedValue(null);
    emailService.sendEmail.mockResolvedValueOnce(false); // SMTP failure

    await processor.handleOutboxSweep();

    expect(prisma.outboxEvent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'outbox-evt-1' },
        data: expect.objectContaining({
          status: 'PENDING',
          attempts: 1,
          leaseExpiresAt: null,
          processingOwner: null,
        }),
      }),
    );
  });

  it('TEST 4: skips duplicate SMTP dispatch if EmailDelivery record is already SENT', async () => {
    bridge.dispatch.mockRejectedValueOnce(new Error('Redis offline'));
    prisma.emailDelivery.findUnique.mockResolvedValue({ status: 'SENT' });

    await processor.handleOutboxSweep();

    expect(emailService.sendEmail).not.toHaveBeenCalled();
    expect(prisma.outboxEvent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'outbox-evt-1' },
        data: expect.objectContaining({ status: 'PROCESSED' }),
      }),
    );
  });

  it('TEST 5: skips SMTP dispatch if another concurrent worker currently holds the EmailDelivery lease', async () => {
    bridge.dispatch.mockRejectedValueOnce(new Error('Redis offline'));
    prisma.emailDelivery.findUnique.mockResolvedValue({
      status: 'PENDING',
      processingOwner: 'other-worker-999',
      leaseExpiresAt: new Date(Date.now() + 30_000), // Active unexpired lease
    });
    // Atomic updateMany returns count 0 because lease is held by other-worker-999
    prisma.emailDelivery.updateMany.mockResolvedValueOnce({ count: 0 });

    await processor.handleOutboxSweep();

    expect(emailService.sendEmail).not.toHaveBeenCalled();
  });
});


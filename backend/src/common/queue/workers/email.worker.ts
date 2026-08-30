import { randomUUID } from 'crypto';
import { Injectable, Logger, OnModuleInit, OnModuleDestroy, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Worker, Job } from 'bullmq';
import { QUEUE_NAMES } from '../bullmq.constants';
import { getRedisConnectionOptions } from '../bullmq.config';
import { BullMQWorkerSecurityService } from '../bullmq.worker.security';
import { BullMQDLQService } from '../bullmq.dlq.service';
import { EmailJobPayload } from '../bullmq.queue.service';
import { EmailService } from '../../../email/email.service';

import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class EmailWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EmailWorker.name);
  readonly workerId = `worker-email-${randomUUID()}`;
  private worker?: Worker;

  constructor(
    private readonly securityService: BullMQWorkerSecurityService,
    @Optional() private readonly emailService?: EmailService,
    @Optional() private readonly configService?: ConfigService,
    @Optional() private readonly dlqService?: BullMQDLQService,
    @Optional() private readonly prisma?: PrismaService,
  ) {}

  async onModuleInit() {
    const isEnabled = this.configService
      ? this.configService.get('ENABLE_QUEUE_WORKERS') !== false &&
        this.configService.get('ENABLE_QUEUE_WORKERS') !== 'false'
      : true;

    if (!isEnabled) {
      this.logger.log(`[WorkerDisabled] EmailWorker is disabled via ENABLE_QUEUE_WORKERS=false`);
      return;
    }

    const connection = getRedisConnectionOptions(this.configService);
    this.worker = new Worker<EmailJobPayload>(
      QUEUE_NAMES.EMAIL,
      async (job: Job) => {
        return this.securityService.processSecureJob<EmailJobPayload>(
          job,
          async (context) => {
            this.logger.log(`Executing email job ${context.jobId} to ${context.data.to}`);

            const eventId = context.eventId || context.jobId;
            const emailDeliveryRepo = this.prisma ? (this.prisma as any).emailDelivery : null;

            // 1. Check Durable PostgreSQL Idempotency Record
            if (emailDeliveryRepo) {
              const existing = await emailDeliveryRepo.findUnique({
                where: { eventId },
              }).catch(() => null);

              if (existing?.status === 'SENT') {
                this.logger.log(`[EmailWorkerIdempotency] Event ${eventId} already SENT. Skipping SMTP execution.`);
                return {
                  status: 'ALREADY_SENT',
                  jobId: context.jobId,
                  eventId,
                  recipient: context.data.to,
                };
              }

              // 2. Atomic Lease Acquisition (P2-1 Concurrent Race Remediation)
              const leaseDurationMs = 60_000;
              const leaseExpiresAt = new Date(Date.now() + leaseDurationMs);
              let acquired = false;

              if (!existing) {
                try {
                  await emailDeliveryRepo.create({
                    data: {
                      eventId,
                      recipient: context.data.to,
                      subject: context.data.subject,
                      status: 'PENDING',
                      processingOwner: this.workerId,
                      leaseExpiresAt,
                    },
                  });
                  acquired = true;
                } catch {
                  acquired = false;
                }
              }

              if (!acquired) {
                const now = new Date();
                const updateResult = await emailDeliveryRepo.updateMany({
                  where: {
                    eventId,
                    status: { in: ['PENDING', 'FAILED'] },
                    OR: [
                      { leaseExpiresAt: null },
                      { leaseExpiresAt: { lt: now } },
                      { processingOwner: this.workerId },
                    ],
                  },
                  data: {
                    processingOwner: this.workerId,
                    leaseExpiresAt,
                  },
                }).catch(() => ({ count: 0 }));

                if (updateResult.count === 0) {
                  const current = await emailDeliveryRepo.findUnique({ where: { eventId } }).catch(() => null);
                  if (current?.status === 'SENT') {
                    this.logger.log(`[EmailWorkerIdempotency] Event ${eventId} already SENT by owner. Skipping SMTP.`);
                    return {
                      status: 'ALREADY_SENT',
                      jobId: context.jobId,
                      eventId,
                      recipient: context.data.to,
                    };
                  }
                  this.logger.warn(`[EmailWorkerIdempotency] Event ${eventId} is locked by active owner ${current?.processingOwner}. Skipping SMTP.`);
                  return {
                    status: 'LOCKED_BY_OTHER_WORKER',
                    jobId: context.jobId,
                    eventId,
                    recipient: context.data.to,
                  };
                }
              }
            }

            // 3. Execute SMTP Dispatch OUTSIDE Database Transaction
            const deterministicMessageId = `<${eventId}@hrnexa.com>`;
            if (this.emailService) {
              const success = await this.emailService.sendEmail({
                to: context.data.to,
                subject: context.data.subject,
                html: context.data.html || context.data.body || context.data.template || '',
                messageId: deterministicMessageId,
              });
              if (!success) {
                if (emailDeliveryRepo) {
                  await emailDeliveryRepo.updateMany({
                    where: {
                      eventId,
                      processingOwner: this.workerId,
                    },
                    data: {
                      status: 'FAILED',
                      processingOwner: null,
                      leaseExpiresAt: null,
                    },
                  }).catch(() => null);
                }
                throw new Error(`Email delivery failed to recipient ${context.data.to}`);
              }
            }

            // 4. Mark Delivery SENT and release lease in PostgreSQL Idempotency Store
            if (emailDeliveryRepo) {
              const sentResult = await emailDeliveryRepo.updateMany({
                where: {
                  eventId,
                  processingOwner: this.workerId,
                },
                data: {
                  status: 'SENT',
                  messageId: deterministicMessageId,
                  processingOwner: null,
                  leaseExpiresAt: null,
                  sentAt: new Date(),
                },
              }).catch(() => ({ count: 0 }));

              if (sentResult.count === 0) {
                this.logger.warn(`[EmailWorkerIdempotency] Stale worker ${this.workerId} rejected from marking event ${eventId} as SENT.`);
              }
            }

            return {
              status: 'COMPLETED',
              jobId: context.jobId,
              eventId,
              recipient: context.data.to,
              messageId: deterministicMessageId,
            };
          },
          this.workerId,
        );
      },
      {
        connection,
        concurrency: 5,
      },
    );

    this.worker.on('error', (err: any) => {
      this.logger.debug(`[EmailWorker] Worker connection error: ${err?.message || err}`);
    });

    this.worker.on('failed', async (job, err) => {
      this.logger.error(`Email worker job ${job?.id} failed: ${err.message}`);
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

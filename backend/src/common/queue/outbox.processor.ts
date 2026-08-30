import { Injectable, Logger, Optional } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { QueueProcessor } from './queue.processor';
import { TenantContextService } from '../tenant/tenant-context.service';
import { validateCanonicalJobContext } from './async-job.validator';
import { AsyncActorValidatorService } from './async-actor.validator';

import { OutboxBullMQBridge } from './outbox-bullmq.bridge';
import { EmailService } from '../../email/email.service';

export interface OutboxEventRecord {
  id: string;
  eventType: string;
  companyId: string | null;
  payload: string;
  status: string;
  attempts: number;
  error: string | null;
  processingOwner?: string | null;
  leaseExpiresAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class OutboxProcessor {
  private readonly logger = new Logger(OutboxProcessor.name);
  private isProcessing = false;
  readonly workerId = `worker-${randomUUID()}`;
  readonly leaseDurationMs = 60_000;
  readonly heartbeatIntervalMs = 15_000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly queueProcessor: QueueProcessor,
    private readonly actorValidator: AsyncActorValidatorService,
    private readonly emailService: EmailService,
    @Optional() private readonly bridge?: OutboxBullMQBridge,
  ) {}

  private get outboxEvent(): any {
    return (this.prisma as any).outboxEvent;
  }

  private get outboxIdempotency(): any {
    return (this.prisma as any).outboxIdempotency;
  }

  /**
   * Atomically claims PENDING (or expired lease PROCESSING) outbox events using PostgreSQL FOR UPDATE SKIP LOCKED.
   * Assigns processingOwner and sets leaseExpiresAt.
   */
  async claimEvents(batchSize = 10): Promise<OutboxEventRecord[]> {
    if (typeof this.prisma.$queryRaw === 'function') {
      try {
        const events = await this.prisma.$queryRaw<OutboxEventRecord[]>`
          UPDATE "OutboxEvent"
          SET "status" = 'PROCESSING',
              "processingOwner" = ${this.workerId},
              "leaseExpiresAt" = NOW() + INTERVAL '60 seconds',
              "updatedAt" = NOW()
          WHERE "id" IN (
            SELECT "id"
            FROM "OutboxEvent"
            WHERE (
              "status" = 'PENDING'
              OR ("status" = 'PROCESSING' AND "leaseExpiresAt" < NOW())
            )
            AND "attempts" < 3
            ORDER BY "createdAt" ASC
            LIMIT ${batchSize}
            FOR UPDATE SKIP LOCKED
          )
          RETURNING *;
        `;
        if (Array.isArray(events) && events.length > 0) {
          return events;
        }
      } catch (err: any) {
        this.logger.debug(`Raw query claim skipped or failed, using fallback: ${err.message}`);
      }
    }

    // Fallback for mock/test environments without full PostgreSQL raw query engine
    if (!this.outboxEvent) return [];

    const now = new Date();
    const pendingEvents = await this.outboxEvent.findMany({
      where: {
        OR: [
          { status: 'PENDING' },
          { status: 'PROCESSING', leaseExpiresAt: { lt: now } },
        ],
        attempts: { lt: 3 },
      },
      take: batchSize,
      orderBy: { createdAt: 'asc' },
    });

    const claimedEvents: OutboxEventRecord[] = [];
    for (const event of pendingEvents) {
      try {
        const updated = await this.outboxEvent.update({
          where: { id: event.id, status: event.status },
          data: {
            status: 'PROCESSING',
            processingOwner: this.workerId,
            leaseExpiresAt: new Date(Date.now() + this.leaseDurationMs),
          },
        });
        if (updated) {
          claimedEvents.push({
            ...event,
            ...(typeof updated === 'object' ? updated : {}),
            status: 'PROCESSING',
            processingOwner: this.workerId,
            leaseExpiresAt: new Date(Date.now() + this.leaseDurationMs),
          } as OutboxEventRecord);
        }
      } catch {
        // Event was already claimed by a concurrent worker instance
      }
    }
    return claimedEvents;
  }

  /**
   * Periodic lease renewal (heartbeat) for active processing owner.
   */
  startHeartbeat(eventId: string, workerId: string): () => void {
    const interval = setInterval(async () => {
      try {
        if (typeof this.prisma.$executeRaw === 'function') {
          await this.prisma.$executeRaw`
            UPDATE "OutboxEvent"
            SET "leaseExpiresAt" = NOW() + INTERVAL '60 seconds',
                "updatedAt" = NOW()
            WHERE "id" = ${eventId}
              AND "status" = 'PROCESSING'
              AND "processingOwner" = ${workerId};
          `;
        } else if (this.outboxEvent?.updateMany) {
          await this.outboxEvent.updateMany({
            where: {
              id: eventId,
              status: 'PROCESSING',
              processingOwner: workerId,
            },
            data: {
              leaseExpiresAt: new Date(Date.now() + this.leaseDurationMs),
            },
          });
        }
      } catch (err: any) {
        this.logger.warn(`Heartbeat lease extension failed for event ${eventId}: ${err.message}`);
      }
    }, this.heartbeatIntervalMs);

    return () => clearInterval(interval);
  }

  @Cron(CronExpression.EVERY_10_SECONDS)
  async handleOutboxSweep() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      const events = await this.claimEvents(10);

      for (const event of events) {
        const stopHeartbeat = this.startHeartbeat(event.id, this.workerId);

        try {
          this.logger.log(`Processing claimed outbox event ${event.id} of type ${event.eventType} by worker ${this.workerId}`);

          let enqueuedToBridge = false;

          if (this.bridge) {
            try {
              // Outbox -> BullMQ Bridge Dispatch Path
              await this.bridge.dispatch(event);
              enqueuedToBridge = true;

              // Mark outbox event as PROCESSED and clear lease upon successful enqueue
              await this.outboxEvent.update({
                where: { id: event.id },
                data: {
                  status: 'PROCESSED',
                  leaseExpiresAt: null,
                  processingOwner: null,
                  attempts: event.attempts + 1,
                },
              });
              continue;
            } catch (bridgeErr: any) {
              this.logger.warn(
                `[OutboxProcessor] BullMQ bridge dispatch failed for event ${event.id}: ${bridgeErr.message}. Falling back to safe local handler.`,
              );
            }
          }

          const rawPayload = JSON.parse(event.payload);

          // Normalize legacy/simple payloads into CanonicalJobContext
          const rawContext: Record<string, unknown> =
            rawPayload && typeof rawPayload === 'object' && 'jobId' in rawPayload
              ? rawPayload
              : {
                  jobId: event.id,
                  eventId: event.id,
                  companyId: event.companyId || rawPayload.companyId || 'DEFAULT_COMPANY',
                  actorUserId: rawPayload.userId || 'system',
                  actorRole: rawPayload.userRole || 'HRAdmin',
                  executionScope: 'TENANT',
                  correlationId: event.id,
                  enqueuedAt: event.createdAt ? new Date(event.createdAt).toISOString() : new Date().toISOString(),
                  data: rawPayload,
                };

          // 1. Validate Canonical Context Structure
          const context = validateCanonicalJobContext(rawContext);

          // 2. Validate Actor Status & Revocation Check
          await this.actorValidator.validateActor(context);

          // 3. Check Event-Level Idempotency Store
          if (this.outboxIdempotency) {
            let idempotency = await this.outboxIdempotency.findUnique({
              where: { eventId: context.eventId },
            });

            if (idempotency?.status === 'COMPLETED') {
              this.logger.log(`Event ${context.eventId} already COMPLETED in idempotency store. Skipping side effect execution.`);
              await this.outboxEvent.update({
                where: { id: event.id },
                data: { status: 'PROCESSED', leaseExpiresAt: null, processingOwner: null, attempts: event.attempts + 1 },
              });
              continue;
            }

            if (!idempotency) {
              try {
                idempotency = await this.outboxIdempotency.create({
                  data: {
                    eventId: context.eventId || event.id,
                    companyId: context.companyId,
                    status: 'PROCESSING',
                  },
                });
              } catch {
                idempotency = await this.outboxIdempotency.findUnique({
                  where: { eventId: context.eventId },
                });
                if (idempotency?.status === 'COMPLETED') {
                  this.logger.log(`Event ${context.eventId} already COMPLETED. Skipping duplicate execution.`);
                  await this.outboxEvent.update({
                    where: { id: event.id },
                    data: { status: 'PROCESSED', leaseExpiresAt: null, processingOwner: null, attempts: event.attempts + 1 },
                  });
                  continue;
                }
              }
            }
          }

          // 4. Execute Event Handler inside Explicit Bound Tenant Context
          const handleEventLogic = async () => {
            if (event.eventType === 'PAYROLL_BATCH_PROCESSED') {
              const payrollData = (context.data || {}) as { month?: string; count?: number; userId?: string };
              this.queueProcessor.processNotificationQueue({
                title: 'Payroll Generated',
                content: `Payroll processed successfully for month ${payrollData.month || ''}. Total employees: ${payrollData.count || 0}`,
                targetUser: payrollData.userId || context.actorUserId,
              });
            } else if (
              event.eventType === 'EMAIL_SEND' ||
              event.eventType === 'EMAIL_DISPATCH' ||
              event.eventType === 'SEND_EMAIL'
            ) {
              const emailData = (context.data || {}) as {
                to: string;
                subject: string;
                body?: string;
                html?: string;
                template?: string;
              };
              if (emailData.to && emailData.subject) {
                const eventId = context.eventId || event.id;
                const emailDeliveryRepo = this.prisma ? (this.prisma as any).emailDelivery : null;

                if (emailDeliveryRepo) {
                  const existing = await emailDeliveryRepo
                    .findUnique({ where: { eventId } })
                    .catch(() => null);
                  if (existing?.status === 'SENT') {
                    this.logger.log(`[OutboxProcessorFallback] Event ${eventId} already SENT. Skipping duplicate SMTP.`);
                    return;
                  }

                  // Atomic lease acquisition to prevent concurrent worker execution
                  const leaseDurationMs = 60_000;
                  const leaseExpiresAt = new Date(Date.now() + leaseDurationMs);
                  let acquired = false;

                  if (!existing) {
                    try {
                      await emailDeliveryRepo.create({
                        data: {
                          eventId,
                          recipient: emailData.to,
                          subject: emailData.subject,
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
                    const updateResult = await emailDeliveryRepo
                      .updateMany({
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
                      })
                      .catch(() => ({ count: 0 }));

                    if (updateResult.count === 0) {
                      this.logger.log(`[OutboxProcessorFallback] Event ${eventId} is locked by another active worker. Skipping.`);
                      return;
                    }
                  }
                }

                const deterministicMessageId = `<${eventId}@hrnexa.com>`;
                const success = await this.emailService.sendEmail({
                  to: emailData.to,
                  subject: emailData.subject,
                  html: emailData.html || emailData.body || emailData.template || '',
                  messageId: deterministicMessageId,
                  companyId: context.companyId === 'PLATFORM' ? undefined : context.companyId,
                });

                if (!success) {
                  if (emailDeliveryRepo) {
                    await emailDeliveryRepo
                      .updateMany({
                        where: { eventId, processingOwner: this.workerId },
                        data: { status: 'FAILED', processingOwner: null, leaseExpiresAt: null },
                      })
                      .catch(() => null);
                  }
                  throw new Error(`Outbox fallback email dispatch failed for recipient ${emailData.to}`);
                }

                // Update SENT status in EmailDelivery idempotency store
                if (emailDeliveryRepo) {
                  await emailDeliveryRepo
                    .updateMany({
                      where: { eventId, processingOwner: this.workerId },
                      data: {
                        status: 'SENT',
                        messageId: deterministicMessageId,
                        processingOwner: null,
                        leaseExpiresAt: null,
                        sentAt: new Date(),
                      },
                    })
                    .catch(() => null);
                }
              }
            }
          };

          if (context.executionScope === 'TENANT') {
            await TenantContextService.runTenant(context.companyId, async () => {
              await handleEventLogic();
            });
          } else if (context.executionScope === 'PLATFORM') {
            await TenantContextService.runPlatform(async () => {
              await handleEventLogic();
            });
          } else {
            throw new Error(`Invalid execution scope: ${context.executionScope}`);
          }

          // Mark idempotency store as COMPLETED if existing
          if (this.outboxIdempotency) {
            try {
              const existing = await this.outboxIdempotency.findUnique({
                where: { eventId: context.eventId },
              });
              if (existing) {
                await this.outboxIdempotency.update({
                  where: { eventId: context.eventId },
                  data: { status: 'COMPLETED' },
                });
              }
            } catch {}
          }

          // Mark outbox event as PROCESSED and clear lease
          await this.outboxEvent.update({
            where: { id: event.id },
            data: { status: 'PROCESSED', leaseExpiresAt: null, processingOwner: null, attempts: event.attempts + 1 },
          });
        } catch (err: any) {
          this.logger.error(`Error processing outbox event ${event.id}: ${err.message}`);

          if (this.outboxIdempotency) {
            try {
              const rawPayload = JSON.parse(event.payload || '{}');
              const eventId = rawPayload?.eventId || event.id;
              const existing = await this.outboxIdempotency.findUnique({
                where: { eventId },
              });
              if (existing) {
                await this.outboxIdempotency.update({
                  where: { eventId },
                  data: { status: 'FAILED', error: err.message || String(err) },
                });
              }
            } catch {}
          }

          await this.outboxEvent.update({
            where: { id: event.id },
            data: {
              status: event.attempts + 1 >= 3 ? 'FAILED' : 'PENDING',
              leaseExpiresAt: null,
              processingOwner: null,
              attempts: event.attempts + 1,
              error: err.message || String(err),
            },
          });
        } finally {
          stopHeartbeat();
        }
      }
    } catch (err: any) {
      this.logger.error(`Outbox sweep failed: ${err.message}`);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Safe, tenant-isolated retention cleanup for PROCESSED OutboxEvent records.
   * Runs daily at midnight. Retains PROCESSED events for 30 days.
   * Deletes in bounded batches of 500 to prevent long database transaction locks.
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async cleanupProcessedOutboxEvents(retentionDays = 30, batchSize = 500): Promise<{ deletedCount: number }> {
    const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
    let totalDeleted = 0;

    try {
      if (typeof this.prisma.$executeRaw === 'function') {
        let deletedBatch = batchSize;
        while (deletedBatch === batchSize) {
          const count = await this.prisma.$executeRaw`
            DELETE FROM "OutboxEvent"
            WHERE "id" IN (
              SELECT "id" FROM "OutboxEvent"
              WHERE "status" = 'PROCESSED'
                AND "updatedAt" < ${cutoffDate}
              LIMIT ${batchSize}
            );
          `;
          deletedBatch = count;
          totalDeleted += count;
          if (count === 0) break;
        }
      } else if (this.outboxEvent?.deleteMany) {
        const result = await this.outboxEvent.deleteMany({
          where: {
            status: 'PROCESSED',
            updatedAt: { lt: cutoffDate },
          },
        });
        totalDeleted = result.count || 0;
      }

      if (totalDeleted > 0) {
        this.logger.log(`[OutboxRetention] Successfully cleaned up ${totalDeleted} PROCESSED OutboxEvent records older than ${retentionDays} days.`);
      }
      return { deletedCount: totalDeleted };
    } catch (err: any) {
      this.logger.error(`[OutboxRetention] Failed to clean up PROCESSED OutboxEvent records: ${err?.message || String(err)}`);
      return { deletedCount: totalDeleted };
    }
  }
}

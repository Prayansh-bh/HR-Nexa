import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { CanonicalJobContext } from './canonical-job-context.interface';

export type PrismaTransaction = Omit<
  PrismaService,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

export interface ActorContext {
  id: string;
  role: string;
}

@Injectable()
export class OutboxPublisherService {
  private readonly logger = new Logger(OutboxPublisherService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Publishes an OutboxEvent inside an explicit PostgreSQL transaction `tx` (or default Prisma instance).
   * Ensures atomic database state change + event creation.
   */
  async publishEvent<T>(
    tx: PrismaTransaction | PrismaService | any,
    eventType: string,
    options: {
      companyId?: string;
      actor: ActorContext;
      executionScope?: 'TENANT' | 'PLATFORM';
      data: T;
      correlationId?: string;
    },
  ) {
    const dbClient = tx || this.prisma;
    const jobId = randomUUID();
    const correlationId = options.correlationId || randomUUID();
    const executionScope =
      options.executionScope ||
      (options.companyId && options.companyId !== 'PLATFORM' ? 'TENANT' : 'PLATFORM');

    const canonicalContext: CanonicalJobContext<T> = {
      jobId,
      eventId: jobId,
      companyId: options.companyId || (executionScope === 'PLATFORM' ? 'PLATFORM' : 'N/A'),
      actorUserId: options.actor?.id || 'system',
      actorRole: options.actor?.role || 'SYSTEM',
      executionScope,
      correlationId,
      enqueuedAt: new Date().toISOString(),
      data: options.data,
    };

    const record = await (dbClient as any).outboxEvent.create({
      data: {
        eventType,
        companyId: canonicalContext.companyId,
        payload: JSON.stringify(canonicalContext),
        status: 'PENDING',
      },
    });

    this.logger.log(
      `[OutboxPublisher] Event ${record.id} (${eventType}) published atomically [Company: ${canonicalContext.companyId}]`,
    );

    return record;
  }

  async publishEmail(
    tx: PrismaTransaction | PrismaService | any,
    options: {
      to: string;
      subject: string;
      body: string;
      companyId?: string;
      actor: ActorContext;
      correlationId?: string;
    },
  ) {
    return this.publishEvent(tx, 'EMAIL_SEND', {
      companyId: options.companyId,
      actor: options.actor,
      executionScope: options.companyId && options.companyId !== 'PLATFORM' ? 'TENANT' : 'PLATFORM',
      data: { to: options.to, subject: options.subject, body: options.body },
      correlationId: options.correlationId,
    });
  }

  async publishNotification(
    tx: PrismaTransaction | PrismaService | any,
    options: {
      title: string;
      content: string;
      targetUser: string;
      companyId?: string;
      actor: ActorContext;
      correlationId?: string;
    },
  ) {
    return this.publishEvent(tx, 'NOTIFICATION_SEND', {
      companyId: options.companyId,
      actor: options.actor,
      executionScope: 'TENANT',
      data: { title: options.title, content: options.content, targetUser: options.targetUser },
      correlationId: options.correlationId,
    });
  }

  async publishReport(
    tx: PrismaTransaction | PrismaService | any,
    options: {
      reportType: string;
      parameters?: Record<string, unknown>;
      companyId?: string;
      actor: ActorContext;
      correlationId?: string;
    },
  ) {
    return this.publishEvent(tx, 'REPORT_GENERATE', {
      companyId: options.companyId,
      actor: options.actor,
      executionScope: options.companyId && options.companyId !== 'PLATFORM' ? 'TENANT' : 'PLATFORM',
      data: { reportType: options.reportType, parameters: options.parameters },
      correlationId: options.correlationId,
    });
  }

  async publishAttendanceSync(
    tx: PrismaTransaction | PrismaService | any,
    options: {
      syncDate: string;
      deviceId?: string;
      companyId?: string;
      actor: ActorContext;
      correlationId?: string;
    },
  ) {
    return this.publishEvent(tx, 'ATTENDANCE_SYNC', {
      companyId: options.companyId,
      actor: options.actor,
      executionScope: 'TENANT',
      data: { syncDate: options.syncDate, deviceId: options.deviceId },
      correlationId: options.correlationId,
    });
  }

  async publishEmployeeSync(
    tx: PrismaTransaction | PrismaService | any,
    options: {
      reason: string;
      delta?: number;
      companyId?: string;
      actor: ActorContext;
      correlationId?: string;
    },
  ) {
    return this.publishEvent(tx, 'EMPLOYEE_SYNC', {
      companyId: options.companyId,
      actor: options.actor,
      executionScope: 'TENANT',
      data: { reason: options.reason, delta: options.delta },
      correlationId: options.correlationId,
    });
  }
}

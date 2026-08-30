import { Injectable, BadRequestException, Logger, Optional } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { EmployeeCountSyncService } from './employee-count-sync.service';
import { OutboxPublisherService } from '../../../common/queue/outbox-publisher.service';

@Injectable()
export class SeatLimitService {
  private readonly logger = new Logger(SeatLimitService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly employeeCountSyncService: EmployeeCountSyncService,
    @Optional() private readonly outboxPublisher?: OutboxPublisherService,
  ) {}

  async verifyCanAddEmployee(companyOrSubId?: string, tx?: any): Promise<void> {
    if (!companyOrSubId) {
      this.logger.warn(
        '[SeatLimitService] No companyOrSubId provided for seat check. Skipping enforcement.',
      );
      return;
    }

    const client = tx || this.prisma;

    let subscription = await client.subscription.findUnique({
      where: { id: companyOrSubId },
    });

    if (!subscription) {
      subscription = await client.subscription.findFirst({
        where: { company: companyOrSubId },
      });
    }

    if (!subscription) {
      this.logger.warn(
        `[SeatLimitService] Subscription not found for tenant identifier "${companyOrSubId}".`,
      );
      return;
    }

    const companyId = subscription.companyId || subscription.id;
    const totalEmployees =
      await this.employeeCountSyncService.getActiveEmployeeCount(
        companyId,
        client,
      );

    const purchasedSeats = subscription.purchasedSeats ?? 50;

    if (totalEmployees >= purchasedSeats) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        errorCode: 'SEAT_LIMIT_REACHED',
        message: `Seat limit reached. ${subscription.company} has used all ${purchasedSeats} allotted seats. Please upgrade your subscription plan to add more employees.`,
        purchasedSeats,
        usedSeats: totalEmployees,
      });
    }

    if (tx) {
      const updated = await tx.subscription.updateMany({
        where: {
          id: subscription.id,
          usedSeats: { lt: purchasedSeats },
        },
        data: {
          usedSeats: { increment: 1 },
          employeesCount: { increment: 1 },
        },
      });

      if (updated.count === 0) {
        throw new BadRequestException({
          statusCode: 400,
          error: 'Bad Request',
          errorCode: 'SEAT_LIMIT_REACHED',
          message: `Seat limit reached. ${subscription.company} has used all ${purchasedSeats} allotted seats. Please upgrade your subscription plan to add more employees.`,
          purchasedSeats,
          usedSeats: totalEmployees,
        });
      }
    }
  }

  /**
   * Synchronizes the usedSeats and employeesCount fields for a specific Subscription.
   * Never infers subscription context from database ordering.
   */
  async syncEmployeeCounts(companyOrSubId?: string, tx?: any): Promise<void> {
    if (!companyOrSubId) {
      return;
    }
    await this.employeeCountSyncService.syncCompany(
      companyOrSubId,
      'SeatLimitService',
      tx,
    );

    if (this.outboxPublisher) {
      await this.outboxPublisher.publishEmployeeSync(tx || this.prisma, {
        reason: 'SeatLimitService',
        companyId: companyOrSubId,
        actor: { id: 'system', role: 'SYSTEM' },
      });
    }
  }
}

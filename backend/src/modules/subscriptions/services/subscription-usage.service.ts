import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Optional,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditLoggerService } from '../../../common/audit/audit-logger.service';
import { BillingCycle } from '../enums/billing-cycle.enum';
import {
  getBusinessDateString,
  calculateSubscriptionExpiry,
} from '../../../common/utils/date.util';

import { SystemConfigService } from '../../system/services/system-config.service';
import { PasswordResetService } from '../../auth/services/password-reset.service';
import { EmployeeCountSyncService } from './employee-count-sync.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  COMPANY_EVENTS,
  SeatCountUpdatedEvent,
} from '../../../common/events/company.events';

@Injectable()
export class SubscriptionUsageService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordResetService: PasswordResetService,
    @Optional() private readonly employeeCountSyncService?: EmployeeCountSyncService,
    @Optional() private readonly auditLogger?: AuditLoggerService,
    @Optional() private readonly systemConfigService?: SystemConfigService,
    @Optional() private readonly eventEmitter?: EventEmitter2,
  ) {}

  private gbToMB(gb: number): number {
    return gb * 1024;
  }

  private mbToDisplayString(mb: number): string {
    const gb = mb / 1024;
    if (Number.isInteger(gb)) {
      return `${gb} GB`;
    }
    return `${gb.toFixed(2).replace(/\.?0+$/, '')} GB`;
  }

  private formatStorage(usedMB: number, limitMB: number): string {
    return `${this.mbToDisplayString(usedMB)} / ${this.mbToDisplayString(limitMB)}`;
  }

  async getSubscriptionById(id: string) {
    const sub = await this.prisma.subscription.findUnique({ where: { id } });
    if (!sub) {
      throw new NotFoundException(`Subscription record with ID "${id}" not found`);
    }

    const [events, invoices] = await Promise.all([
      this.getSubscriptionEvents(id),
      this.prisma.invoice.findMany({ where: { subscriptionId: id } }),
    ]);

    return { ...sub, events, invoices };
  }

  async getUsage(subscriptionId: string) {
    const sub = await this.prisma.subscription.findUnique({
      where: { id: subscriptionId },
    });

    if (!sub) {
      throw new NotFoundException(
        `Subscription record with ID "${subscriptionId}" not found`,
      );
    }

    const companyId = sub.companyId || sub.id;

    const [employeesCount, documentsCount, leaveRequestsCount] = await Promise.all([
      this.prisma.employee.count({
        where: { OR: [{ subscriptionId }, { companyId }] },
      }),
      this.prisma.document.count({ where: { companyId } }),
      this.prisma.leaveRequest.count({ where: { companyId } }),
    ]);

    const storageUsedMB = sub.storageUsedMB || 0;
    const storageLimitMB = sub.storageLimitMB || 10240;
    const storagePercentage =
      storageLimitMB > 0
        ? Math.min(Math.round((storageUsedMB / storageLimitMB) * 100), 100)
        : 0;

    const purchasedSeats = sub.purchasedSeats || 10;
    const seatPercentage =
      purchasedSeats > 0
        ? Math.min(Math.round((employeesCount / purchasedSeats) * 100), 100)
        : 0;

    return {
      subscriptionId: sub.id,
      company: sub.company,
      plan: sub.plan,
      purchasedSeats,
      usedSeats: employeesCount,
      seatPercentage,
      storageUsedMB,
      storageLimitMB,
      storageUsedFormatted: this.mbToDisplayString(storageUsedMB),
      storageLimitFormatted: this.mbToDisplayString(storageLimitMB),
      storagePercentage,
      documentsCount,
      leaveRequestsCount,
      status: sub.status,
    };
  }

  async getSubscriptionEvents(subscriptionId: string) {
    const sub = await this.prisma.subscription.findUnique({
      where: { id: subscriptionId },
    });
    if (!sub) {
      throw new NotFoundException(
        `Subscription record with ID "${subscriptionId}" not found`,
      );
    }

    const logs = await this.prisma.auditLog.findMany({
      where: { companyId: sub.companyId || subscriptionId },
      orderBy: { timestamp: 'desc' },
      take: 50,
    });

    return logs.map((l) => ({
      id: l.id,
      company: sub.company,
      type: l.action,
      timestamp: l.timestamp.toISOString(),
      details: l.details || '',
    }));
  }

  async addStorage(id: string, body: { storageGB?: number; storage?: string }) {
    let additionalGB: number | null = null;
    if (typeof body?.storageGB === 'number') {
      additionalGB = body.storageGB;
    } else if (typeof body?.storage === 'string') {
      const match = body.storage.trim().match(/^(\d+(?:\.\d+)?)\s*(?:GB)?$/i);
      if (match) {
        additionalGB = parseFloat(match[1]);
      }
    }

    if (additionalGB === null || isNaN(additionalGB) || additionalGB <= 0) {
      throw new BadRequestException(
        'Invalid storage amount. Must be a positive number of GB.',
      );
    }

    const sub = await this.prisma.subscription.findUnique({ where: { id } });
    if (!sub) {
      throw new NotFoundException(`Subscription record with ID "${id}" not found`);
    }

    const additionalMB = this.gbToMB(additionalGB);
    const newLimitMB = (sub.storageLimitMB || 10240) + additionalMB;
    const newStorageUsedText = this.formatStorage(
      sub.storageUsedMB || 0,
      newLimitMB,
    );

    const updated = await this.prisma.subscription.update({
      where: { id },
      data: {
        storageLimitMB: newLimitMB,
        storageUsed: newStorageUsedText,
      },
    });

    return {
      success: true,
      message: `Added ${additionalGB} GB to ${sub.company}.`,
      subscription: updated,
    };
  }

  async resetPassword(id: string) {
    const sub = await this.prisma.subscription.findUnique({ where: { id } });
    if (!sub) {
      throw new NotFoundException(`Subscription with ID "${id}" not found`);
    }

    // 1. Authoritative lookup: User with HRAdmin role directly linked to this subscription
    let hrAdmin = await this.prisma.user.findFirst({
      where: { subscriptionId: sub.id, role: 'HRAdmin' },
    });

    // 2. Authoritative lookup: User with HRAdmin role linked to company
    if (!hrAdmin && sub.companyId) {
      hrAdmin = await this.prisma.user.findFirst({
        where: { companyId: sub.companyId, role: 'HRAdmin' },
      });
    }

    // 3. Fallback: Lookup designated ownerEmail/hrAdmin strictly scoped to this tenant
    if (!hrAdmin && (sub.ownerEmail || sub.hrAdmin)) {
      const candidateEmail = (sub.ownerEmail || sub.hrAdmin)!.trim().toLowerCase();
      hrAdmin = await this.prisma.user.findFirst({
        where: {
          email: candidateEmail,
          OR: [
            { subscriptionId: sub.id },
            { companyId: sub.companyId || undefined },
          ],
        },
      });
    }

    if (!hrAdmin) {
      throw new NotFoundException(
        `No authoritative HRAdmin user found for subscription "${sub.company}".`,
      );
    }

    // Delegate directly using the verified User entity (avoids second ambiguous email lookup)
    await this.passwordResetService.requestPasswordResetForUser(hrAdmin);

    // Generic response with zero email leakage
    return {
      success: true,
      message: 'Password reset link queued successfully.',
    };
  }

  async extendTrial(id: string, customDays?: number) {
    const sub = await this.prisma.subscription.findUnique({ where: { id } });
    if (!sub) {
      throw new NotFoundException(`Subscription with ID "${id}" not found`);
    }
    if (sub.status === 'Archived' || sub.status === 'Deleted') {
      throw new BadRequestException(`Cannot extend trial for ${sub.status} subscription`);
    }

    const defaultTrialDays = this.systemConfigService
      ? await this.systemConfigService.getConfiguredTrialDays()
      : 14;
    const trialDays = customDays && customDays > 0 ? customDays : defaultTrialDays;

    const todayStr = getBusinessDateString();
    const baseExpiry = sub.expiry && sub.expiry > todayStr ? sub.expiry : todayStr;
    const newExpiry = calculateSubscriptionExpiry(
      baseExpiry,
      BillingCycle.TRIAL,
      trialDays,
    );

    const updated = await this.prisma.subscription.update({
      where: { id },
      data: { expiry: newExpiry, status: 'Trial', cycle: BillingCycle.TRIAL },
    });

    await this.prisma.subscriptionEvent.create({
      data: {
        subscriptionId: id,
        event: 'TrialExtended',
        fromPlan: sub.plan,
        toPlan: sub.plan,
        fromStatus: sub.status,
        toStatus: 'Trial',
        performedBy: 'SuperAdmin',
        note: `Extended trial by ${trialDays} days until ${newExpiry}`,
      },
    }).catch(() => null);

    return updated;
  }

  async editProfile(id: string, data: any) {
    const sub = await this.prisma.subscription.findUnique({ where: { id } });
    if (!sub) {
      throw new NotFoundException(`Subscription with ID "${id}" not found`);
    }

    const companyName = data.name || data.company || sub.company;

    return this.prisma.$transaction(async (tx) => {
      const updatedSub = await tx.subscription.update({
        where: { id },
        data: {
          company: companyName,
          address: data.address !== undefined ? data.address : sub.address,
          contact: data.contact !== undefined ? data.contact : sub.contact,
          gst: data.gst !== undefined ? data.gst : sub.gst,
          pan: data.pan !== undefined ? data.pan : sub.pan,
          cin: data.cin !== undefined ? data.cin : sub.cin,
          hrAdmin: data.hrAdmin !== undefined ? data.hrAdmin : sub.hrAdmin,
          ownerName: data.ownerName !== undefined ? data.ownerName : sub.ownerName,
          ownerEmail: data.ownerEmail !== undefined ? data.ownerEmail : sub.ownerEmail,
          billing: data.billing !== undefined ? data.billing : sub.billing,
        },
      });

      if (sub.companyId) {
        await tx.company.update({
          where: { id: sub.companyId },
          data: { name: companyName },
        }).catch(() => null);
      }

      return updatedSub;
    });
  }

  async updatePurchasedSeats(id: string, seats: number, actor?: any) {
    if (!Number.isInteger(seats) || seats < 1) {
      throw new BadRequestException('Purchased seats must be a positive integer >= 1.');
    }

    return this.prisma.$transaction(async (tx) => {
      const sub = await tx.subscription.findUnique({ where: { id } });
      if (!sub) {
        throw new NotFoundException(`Subscription record with ID "${id}" not found`);
      }

      const companyId = sub.companyId || sub.id;
      let activeEmployeeCount = 0;
      if (this.employeeCountSyncService) {
        activeEmployeeCount = await this.employeeCountSyncService.getActiveEmployeeCount(
          companyId,
          tx,
        );
      } else {
        activeEmployeeCount = await tx.employee.count({
          where: {
            OR: [{ companyId }, { subscriptionId: companyId }],
            status: { in: ['Active', 'ACTIVE', 'On Leave'] },
          },
        });
      }

      if (seats < activeEmployeeCount) {
        throw new BadRequestException({
          statusCode: 400,
          error: 'Bad Request',
          errorCode: 'SEATS_BELOW_ACTIVE_EMPLOYEES',
          message: `Cannot reduce seats below the current active employee count (${activeEmployeeCount}).`,
          purchasedSeats: seats,
          activeEmployeeCount,
        });
      }

      const previousSeats = sub.purchasedSeats ?? 10;
      const effectiveUsedSeats = Math.min(activeEmployeeCount, seats);

      const updated = await tx.subscription.update({
        where: { id },
        data: {
          purchasedSeats: seats,
          usedSeats: effectiveUsedSeats,
          employeesCount: activeEmployeeCount,
        },
      });

      // Record subscription event
      await tx.subscriptionEvent
        .create({
          data: {
            subscriptionId: id,
            event: 'SeatsUpdated',
            fromPlan: sub.plan,
            toPlan: sub.plan,
            fromStatus: sub.status,
            toStatus: sub.status,
            performedBy: actor?.name || actor?.email || 'SuperAdmin',
            note: `Updated purchased seats from ${previousSeats} to ${seats} (Active employees: ${activeEmployeeCount})`,
          },
        })
        .catch(() => null);

      if (this.eventEmitter) {
        this.eventEmitter.emit(
          COMPANY_EVENTS.SEAT_COUNT_UPDATED,
          new SeatCountUpdatedEvent(
            sub.id,
            companyId,
            effectiveUsedSeats,
            seats,
          ),
        );
      }

      return {
        id: updated.id,
        company: updated.company,
        companyId: updated.companyId,
        purchasedSeats: updated.purchasedSeats,
        activeEmployeeCount,
        availableSeats: Math.max(0, (updated.purchasedSeats ?? 0) - activeEmployeeCount),
        status: updated.status,
        plan: updated.plan,
      };
    });
  }

  /**
   * @deprecated DO NOT USE DIRECTLY. Direct subscription status mutations bypass lifecycle state machines,
   * user status cascades, and domain event emissions. Use SubscriptionLifecycleService methods instead.
   */
  async updateSubscriptionStatus(id: string, status: string) {
    return this.prisma.subscription.update({
      where: { id },
      data: { status },
    });
  }
}

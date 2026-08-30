import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  Optional,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Decimal } from '@prisma/client/runtime/library';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../../prisma/prisma.service';
import { TokenBlacklistService } from '../../auth/services/token-blacklist.service';
import { AuditLoggerService } from '../../../common/audit/audit-logger.service';
import { SubscriptionStatus } from '../enums/subscription-status.enum';
import { BillingCycle } from '../enums/billing-cycle.enum';
import {
  SubscriptionRenewedEvent,
  PlanChangedEvent,
  CompanySuspendedEvent,
  CompanyActivatedEvent,
  CompanyDeletedEvent,
  COMPANY_EVENTS,
} from '../../../common/events/company.events';

import {
  getBusinessDateString,
  calculateSubscriptionExpiry,
} from '../../../common/utils/date.util';
import { SystemConfigService } from '../../system/services/system-config.service';

import { StorageService } from '../../../common/storage/storage.service';

export function normalizeRenewalDuration(
  durationStr?: string,
  fallbackCycle?: string,
): {
  normalizedDuration: '14_DAYS' | '1_MONTH' | '1_YEAR';
  cycle: string;
} {
  const raw = (durationStr || '').trim();
  if (!raw) {
    const cycleNorm = (fallbackCycle || 'Monthly').trim().toLowerCase();
    if (cycleNorm === 'annual' || cycleNorm === 'yearly') {
      return { normalizedDuration: '1_YEAR', cycle: BillingCycle.ANNUAL };
    }
    if (cycleNorm === 'trial') {
      return { normalizedDuration: '14_DAYS', cycle: BillingCycle.TRIAL };
    }
    return { normalizedDuration: '1_MONTH', cycle: BillingCycle.MONTHLY };
  }

  const lower = raw.toLowerCase().replace(/[\s_-]+/g, '');
  if (lower === '14days' || lower === '14day' || lower === 'trial') {
    return { normalizedDuration: '14_DAYS', cycle: BillingCycle.TRIAL };
  }
  if (lower === '1year' || lower === '1yr' || lower === 'annual' || lower === 'yearly') {
    return { normalizedDuration: '1_YEAR', cycle: BillingCycle.ANNUAL };
  }
  if (lower === '1month' || lower === '1mo' || lower === 'monthly') {
    return { normalizedDuration: '1_MONTH', cycle: BillingCycle.MONTHLY };
  }

  throw new BadRequestException(
    `Unsupported renewal duration "${durationStr}". Expected 14_DAYS, 1_MONTH, or 1_YEAR.`,
  );
}

@Injectable()
export class SubscriptionLifecycleService {
  private readonly logger = new Logger(SubscriptionLifecycleService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokenBlacklistService: TokenBlacklistService,
    private readonly eventEmitter: EventEmitter2,
    @Optional() private readonly auditLogger?: AuditLoggerService,
    @Optional() private readonly systemConfigService?: SystemConfigService,
    @Optional() private readonly storageService?: StorageService,
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

  private async resolvePlanAndVersion(planIdentifier: string) {
    let plan = await this.prisma.saaSPlanNew.findFirst({
      where: {
        status: { not: 'Archived' },
        OR: [{ id: planIdentifier }, { code: planIdentifier }],
      },
    });

    if (!plan) {
      plan = await this.prisma.saaSPlanNew.findFirst({
        where: {
          status: { not: 'Archived' },
          name: { equals: planIdentifier, mode: 'insensitive' },
        },
      });
    }

    if (!plan) {
      throw new BadRequestException(`SaaS Plan "${planIdentifier}" not found.`);
    }

    const version = await this.prisma.planVersion.findFirst({
      where: {
        planId: plan.id,
        status: 'Published',
      },
      orderBy: {
        version: 'desc',
      },
    });

    if (!version) {
      throw new BadRequestException(
        `No published version found for plan "${plan.name}".`,
      );
    }

    return { plan, version };
  }

  async upgradeSubscription(id: string, planNameOrCode: string) {
    const { plan, version } = await this.resolvePlanAndVersion(planNameOrCode);

    return this.prisma.$transaction(
      async (tx) => {
        // Preserving FOR UPDATE row locking for concurrency safety
        const [sub]: any[] = await tx.$queryRaw`
          SELECT *
          FROM "Subscription"
          WHERE id = ${id}
          FOR UPDATE
        `;
        if (!sub) {
          throw new NotFoundException('Subscription not found');
        }

        const cycle = sub.cycle || BillingCycle.MONTHLY;
        const amount =
          cycle === BillingCycle.ANNUAL ? version.yearlyPrice : version.monthlyPrice;

        if (amount > 0 && plan.name !== sub.plan) {
          const randomSuffix = Math.floor(100 + Math.random() * 900);
          const invoiceId = `INV-UPG-${Date.now()}-${randomSuffix}`;
          const todayStr = new Date().toISOString().slice(0, 10);

          await tx.invoice.create({
            data: {
              id: invoiceId,
              type: 'Invoice',
              company: sub.company,
              date: todayStr,
              amount,
              status: 'Pending',
              subscriptionId: sub.id,
              planName: plan.name,
              planVersion: version.version,
              seatCount: version.employeeLimit,
              storageGB: version.storageLimitGB,
              unitPrice: new Decimal(amount),
            },
          });

          await tx.invoice.update({
            where: { id: invoiceId },
            data: { status: 'Paid' },
          });
        }

        const newStorageLimitMB = this.gbToMB(version.storageLimitGB);
        const newStorageUsedText = this.formatStorage(
          sub.storageUsedMB || 0,
          newStorageLimitMB,
        );

        let extraAddOnSeats = 0;
        try {
          const { version: oldVersion } = await this.resolvePlanAndVersion(sub.plan);
          if (
            oldVersion &&
            typeof sub.purchasedSeats === 'number' &&
            sub.purchasedSeats > oldVersion.employeeLimit
          ) {
            extraAddOnSeats = sub.purchasedSeats - oldVersion.employeeLimit;
          }
        } catch {
          // Non-fatal if previous plan details are legacy/unversioned
        }
        const effectivePurchasedSeats = version.employeeLimit + extraAddOnSeats;

        const updated = await tx.subscription.update({
          where: { id },
          data: {
            plan: plan.name,
            amount,
            purchasedSeats: effectivePurchasedSeats,
            storageLimitMB: newStorageLimitMB,
            storageUsed: newStorageUsedText,
            status: cycle === BillingCycle.ANNUAL ? SubscriptionStatus.ACTIVE : SubscriptionStatus.PAID,
          },
        });

        const todayStr = new Date().toISOString().slice(0, 10);
        await tx.companyPlanAssignment.upsert({
          where: { company: sub.company },
          update: {
            planVersionId: version.id,
            assignedBy: 'SuperAdmin',
            effectiveDate: todayStr,
            status: 'Active',
          },
          create: {
            company: sub.company,
            planVersionId: version.id,
            assignedBy: 'SuperAdmin',
            effectiveDate: todayStr,
            status: 'Active',
          },
        });

        // Tenant-scoped permissionVersion invalidation for live user sessions
        if (sub.companyId) {
          await tx.user.updateMany({
            where: { companyId: sub.companyId },
            data: { permissionVersion: { increment: 1 } },
          });
        }

        await tx.subscriptionEvent.create({
          data: {
            subscriptionId: id,
            event: 'Upgraded',
            fromPlan: sub.plan,
            toPlan: plan.name,
            fromStatus: sub.status,
            toStatus: updated.status,
            performedBy: 'SuperAdmin',
            note: `Upgraded plan from ${sub.plan} to ${plan.name}`,
          },
        });

        this.eventEmitter.emit(
          COMPANY_EVENTS.PLAN_CHANGED,
          new PlanChangedEvent(id, sub.company, sub.plan, plan.name),
        );

        if (this.auditLogger) {
          await this.auditLogger
            .logAction({
              companyId: id,
              action: 'Plan Upgraded',
              oldValue: { plan: sub.plan },
              newValue: { plan: plan.name },
              details: `Upgraded plan for "${sub.company}" from ${sub.plan} to ${plan.name}`,
            })
            .catch(() => null);
        }

        return updated;
      },
      { maxWait: 15000, timeout: 45000 },
    );
  }

  async downgradeSubscription(id: string, planNameOrCode: string) {
    const { plan, version } = await this.resolvePlanAndVersion(planNameOrCode);

    return this.prisma.$transaction(
      async (tx) => {
        const [sub]: any[] = await tx.$queryRaw`
          SELECT *
          FROM "Subscription"
          WHERE id = ${id}
          FOR UPDATE
        `;
        if (!sub) {
          throw new NotFoundException('Subscription not found');
        }

        const cycle = sub.cycle || BillingCycle.MONTHLY;
        const amount =
          cycle === BillingCycle.ANNUAL ? version.yearlyPrice : version.monthlyPrice;

        const newStorageLimitMB = this.gbToMB(version.storageLimitGB);
        const newStorageUsedText = this.formatStorage(
          sub.storageUsedMB || 0,
          newStorageLimitMB,
        );

        let extraAddOnSeats = 0;
        try {
          const { version: oldVersion } = await this.resolvePlanAndVersion(sub.plan);
          if (
            oldVersion &&
            typeof sub.purchasedSeats === 'number' &&
            sub.purchasedSeats > oldVersion.employeeLimit
          ) {
            extraAddOnSeats = sub.purchasedSeats - oldVersion.employeeLimit;
          }
        } catch {
          // Non-fatal if previous plan details are legacy/unversioned
        }
        const effectivePurchasedSeats = version.employeeLimit + extraAddOnSeats;

        const updated = await tx.subscription.update({
          where: { id },
          data: {
            plan: plan.name,
            amount,
            purchasedSeats: effectivePurchasedSeats,
            storageLimitMB: newStorageLimitMB,
            storageUsed: newStorageUsedText,
          },
        });

        const todayStr = new Date().toISOString().slice(0, 10);
        await tx.companyPlanAssignment.upsert({
          where: { company: sub.company },
          update: {
            planVersionId: version.id,
            assignedBy: 'SuperAdmin',
            effectiveDate: todayStr,
            status: 'Active',
          },
          create: {
            company: sub.company,
            planVersionId: version.id,
            assignedBy: 'SuperAdmin',
            effectiveDate: todayStr,
            status: 'Active',
          },
        });

        // Tenant-scoped permissionVersion invalidation for live user sessions
        if (sub.companyId) {
          await tx.user.updateMany({
            where: { companyId: sub.companyId },
            data: { permissionVersion: { increment: 1 } },
          });
        }

        await tx.subscriptionEvent.create({
          data: {
            subscriptionId: id,
            event: 'Downgraded',
            fromPlan: sub.plan,
            toPlan: plan.name,
            fromStatus: sub.status,
            toStatus: updated.status,
            performedBy: 'SuperAdmin',
            note: `Downgraded plan from ${sub.plan} to ${plan.name}`,
          },
        });

        this.eventEmitter.emit(
          COMPANY_EVENTS.PLAN_CHANGED,
          new PlanChangedEvent(id, sub.company, sub.plan, plan.name),
        );

        if (this.auditLogger) {
          await this.auditLogger
            .logAction({
              companyId: id,
              action: 'Plan Downgraded',
              oldValue: { plan: sub.plan },
              newValue: { plan: plan.name },
              details: `Downgraded plan for "${sub.company}" from ${sub.plan} to ${plan.name}`,
            })
            .catch(() => null);
        }

        return updated;
      },
      { maxWait: 15000, timeout: 45000 },
    );
  }

  async renewSubscription(id: string, duration?: string) {
    return this.prisma.$transaction(
      async (tx) => {
        // Preserving FOR UPDATE row-level locking
        const [sub]: any[] = await tx.$queryRaw`
          SELECT *
          FROM "Subscription"
          WHERE id = ${id}
          FOR UPDATE
        `;
        if (!sub) {
          throw new NotFoundException('Subscription not found');
        }

        if (sub.status === 'Archived' || sub.status === 'Deleted') {
          throw new BadRequestException(`Cannot renew ${sub.status} subscription`);
        }

        const { plan, version } = await this.resolvePlanAndVersion(sub.plan);

        const { normalizedDuration, cycle } = normalizeRenewalDuration(
          duration,
          sub.cycle,
        );

        let renewalAmount = 0;
        if (normalizedDuration === '14_DAYS') {
          renewalAmount = 0;
        } else if (normalizedDuration === '1_MONTH') {
          renewalAmount = version.monthlyPrice;
        } else if (normalizedDuration === '1_YEAR') {
          renewalAmount = version.yearlyPrice;
        }

        const todayStr = getBusinessDateString();
        // Expired Anchor Rule: max(existingExpiry, currentBusinessDate)
        const renewalStart =
          sub.expiry && sub.expiry > todayStr ? sub.expiry : todayStr;

        const trialDays = this.systemConfigService
          ? await this.systemConfigService.getConfiguredTrialDays()
          : 14;
        const newExpiry = calculateSubscriptionExpiry(
          renewalStart,
          cycle,
          trialDays,
        );

        if (renewalAmount > 0) {
          const randomSuffix = Math.floor(100 + Math.random() * 900);
          const invoiceId = `INV-REN-${Date.now()}-${randomSuffix}`;

          await tx.invoice.create({
            data: {
              id: invoiceId,
              type: 'Invoice',
              company: sub.company,
              date: todayStr,
              amount: renewalAmount,
              status: 'Pending',
              subscriptionId: sub.id,
              planName: plan.name,
              planVersion: version.version,
              seatCount: version.employeeLimit,
              storageGB: version.storageLimitGB,
              unitPrice: new Decimal(renewalAmount),
            },
          });

          await tx.invoice.update({
            where: { id: invoiceId },
            data: { status: 'Paid' },
          });
        }

        let newStatus: string;
        if (sub.status === 'Trial' && normalizedDuration === '14_DAYS') {
          newStatus = SubscriptionStatus.TRIAL;
        } else if (cycle === BillingCycle.ANNUAL) {
          newStatus = SubscriptionStatus.ACTIVE;
        } else if (renewalAmount > 0) {
          newStatus = SubscriptionStatus.PAID;
        } else {
          newStatus = SubscriptionStatus.ACTIVE;
        }

        const updated = await tx.subscription.update({
          where: { id },
          data: {
            start: renewalStart,
            expiry: newExpiry,
            amount: renewalAmount,
            cycle,
            status: newStatus,
          },
        });

        await tx.subscriptionEvent.create({
          data: {
            subscriptionId: id,
            event: 'Renewed',
            fromPlan: sub.plan,
            toPlan: sub.plan,
            fromStatus: sub.status,
            toStatus: updated.status,
            performedBy: 'SuperAdmin',
            note: `Renewed subscription (${normalizedDuration}) until ${newExpiry}${
              renewalAmount > 0 ? ` (₹${renewalAmount})` : ' (Free/Courtesy)'
            }`,
          },
        });

        this.eventEmitter.emit(
          COMPANY_EVENTS.SUBSCRIPTION_RENEWED,
          new SubscriptionRenewedEvent(id, sub.company, newExpiry),
        );

        if (this.auditLogger) {
          await this.auditLogger
            .logAction({
              companyId: id,
              action: 'Subscription Renewed',
              oldValue: { expiry: sub.expiry, status: sub.status },
              newValue: { expiry: newExpiry, status: updated.status },
              details: `Renewed subscription for "${sub.company}" (${normalizedDuration}) until ${newExpiry}`,
            })
            .catch(() => null);
        }

        return updated;
      },
      { maxWait: 15000, timeout: 45000 },
    );
  }

  async suspendSubscription(id: string, reason?: string) {
    const updated = await this.prisma.subscription.update({
      where: { id },
      data: {
        status: SubscriptionStatus.SUSPENDED,
        suspendedAt: new Date().toISOString().slice(0, 10),
        suspendReason: reason || null,
      },
    });

    await this.prisma.user.updateMany({
      where: { subscriptionId: id },
      data: { status: 'Disabled' },
    });

    this.eventEmitter.emit(
      COMPANY_EVENTS.SUSPENDED,
      new CompanySuspendedEvent(id, updated.company, reason),
    );

    if (this.auditLogger) {
      await this.auditLogger
        .logAction({
          companyId: id,
          action: 'Subscription Suspended',
          newValue: { status: SubscriptionStatus.SUSPENDED, reason },
          details: `Suspended subscription for "${updated.company}"`,
        })
        .catch(() => null);
    }

    return updated;
  }

  async reactivateSubscription(id: string) {
    const updated = await this.prisma.subscription.update({
      where: { id },
      data: { status: SubscriptionStatus.ACTIVE },
    });

    await this.prisma.user.updateMany({
      where: { subscriptionId: id },
      data: { status: 'Active' },
    });

    this.eventEmitter.emit(
      COMPANY_EVENTS.ACTIVATED,
      new CompanyActivatedEvent(id, updated.company),
    );

    if (this.auditLogger) {
      await this.auditLogger
        .logAction({
          companyId: id,
          action: 'Subscription Reactivated',
          newValue: { status: SubscriptionStatus.ACTIVE },
          details: `Reactivated subscription for "${updated.company}"`,
        })
        .catch(() => null);
    }

    return updated;
  }

  async cancelSubscription(id: string, note?: string) {
    const todayStr = new Date().toISOString().slice(0, 10);
    const updated = await this.prisma.subscription.update({
      where: { id },
      data: {
        status: SubscriptionStatus.CANCELLED,
        cancelledAt: todayStr,
        notes: note || null,
        autoRenew: false,
      },
    });

    if (this.auditLogger) {
      await this.auditLogger
        .logAction({
          companyId: id,
          action: 'Subscription Cancelled',
          newValue: { status: SubscriptionStatus.CANCELLED, note },
          details: `Cancelled subscription for "${updated.company}"`,
        })
        .catch(() => null);
    }

    return updated;
  }

  async setAutoRenew(id: string, autoRenew: boolean) {
    return this.prisma.subscription.update({
      where: { id },
      data: { autoRenew },
    });
  }

  /**
   * Default deleteSubscription: ARCHIVE (Soft-Disable).
   * Revokes user login tokens, disables user accounts, halts billing, and marks subscription as Archived.
   * Tax, payroll, attendance, and compliance records are SAFELY RETAINED.
   */
  async deleteSubscription(id: string) {
    const sub = await this.prisma.subscription.findUnique({ where: { id } });
    if (!sub) {
      throw new NotFoundException(`Subscription record with ID "${id}" not found`);
    }

    const companyId = sub.companyId || sub.id;

    await this.prisma.$transaction(async (tx) => {
      // 1. Soft-disable all tenant users
      await tx.user.updateMany({
        where: { OR: [{ subscriptionId: id }, { companyId }] },
        data: { status: 'Disabled' },
      });

      // 2. Mark subscription as Archived and AutoRenew false
      await tx.subscription.update({
        where: { id },
        data: {
          status: SubscriptionStatus.ARCHIVED,
          autoRenew: false,
        },
      });
    });

    this.eventEmitter.emit(
      COMPANY_EVENTS.DELETED,
      new CompanyDeletedEvent(id, sub.company),
    );

    if (this.auditLogger) {
      await this.auditLogger
        .logAction({
          companyId: id,
          action: 'Subscription Archived',
          details: `Archived subscription and disabled access for company "${sub.company}"`,
        })
        .catch(() => null);
    }

    return { success: true, message: `Subscription "${sub.company}" archived successfully.` };
  }

  /**
   * PurgeSubscription: Explicit SuperAdmin-only Operation for Hard Deletion.
   * Enforces strict Archive status requirement, company name confirmation,
   * exhaustive 32-model leaf-to-root atomic transaction, and post-commit storage cleanup.
   */
  async purgeSubscription(id: string, confirmCompanyName?: string) {
    const sub = await this.prisma.subscription.findUnique({ where: { id } });
    if (!sub) {
      throw new NotFoundException(`Subscription record with ID "${id}" not found`);
    }

    if (sub.status !== SubscriptionStatus.ARCHIVED) {
      throw new BadRequestException(
        `Cannot permanently purge an active company. The company must be archived first. (Current status: "${sub.status}")`,
      );
    }

    if (
      !confirmCompanyName ||
      confirmCompanyName.trim().toLowerCase() !== sub.company.trim().toLowerCase()
    ) {
      throw new BadRequestException(
        `Company name confirmation mismatch. Expected "${sub.company}", received "${confirmCompanyName || ''}".`,
      );
    }

    const companyId = sub.companyId || sub.id;

    // 1. Pre-fetch scalar unlinked IDs
    const tenantUsers = await this.prisma.user.findMany({
      where: { OR: [{ subscriptionId: id }, { companyId }] },
      select: { id: true },
    });
    const userIds = tenantUsers.map((u) => u.id);

    const tenantTickets = await this.prisma.supportTicket.findMany({
      where: { OR: [{ companyId }, { company: sub.company }] },
      select: { id: true },
    });
    const ticketIds = tenantTickets.map((t) => t.id);

    // 2. Pre-fetch storage references for post-commit cleanup
    const documentFiles = await this.prisma.document.findMany({
      where: { companyId },
      select: { filePath: true },
    });
    const exitDocs = await this.prisma.exitDocument.findMany({
      where: { exit: { companyId } },
      select: { storageKey: true },
    });
    const payrolls = await this.prisma.payroll.findMany({
      where: { companyId },
      select: { payslipPath: true },
    });
    const candidates = await this.prisma.candidate.findMany({
      where: { subscriptionId: id },
      select: { resume: true },
    });
    const employees = await this.prisma.employee.findMany({
      where: { OR: [{ subscriptionId: id }, { companyId }] },
      select: { avatar: true },
    });
    const avatarPaths = employees
      .map((e) => e.avatar)
      .filter(
        (av): av is string =>
          Boolean(
            av &&
              (av.startsWith('uploads/') ||
                av.startsWith('./uploads/') ||
                av.startsWith('s3://') ||
                av.includes('/uploads/')),
          ),
      );

    // 3. Record PLATFORM-level immutable audit tombstone before tenant data deletion
    if (this.auditLogger) {
      await this.auditLogger
        .logAction({
          companyId: 'PLATFORM',
          action: 'Tenant Purged',
          details: `SuperAdmin permanently purged tenant "${sub.company}" (Company ID: ${companyId}, Subscription ID: ${id}) at ${new Date().toISOString()}`,
          newValue: {
            purgedCompanyId: companyId,
            purgedSubscriptionId: id,
            purgedCompanyName: sub.company,
            purgedAt: new Date().toISOString(),
          },
        })
        .catch(() => null);
    }

    // 4. Execute atomic PostgreSQL deletion transaction
    await this.prisma.$transaction(
      async (tx) => {
        // LEVEL 0: Leaf records & Restrict FK children
        if (ticketIds.length > 0) {
          await tx.ticketMessage.deleteMany({ where: { ticketId: { in: ticketIds } } });
        }
        if (userIds.length > 0) {
          await tx.otpChallenge.deleteMany({ where: { userId: { in: userIds } } });
        }
        await tx.expenseClaimItem.deleteMany({ where: { claim: { companyId } } });
        await tx.taxDeclarationItem.deleteMany({ where: { declaration: { companyId } } });
        await tx.exitDocument.deleteMany({ where: { exit: { companyId } } });
        await tx.exitTimeline.deleteMany({ where: { exit: { companyId } } });
        await tx.exitSettlement.deleteMany({ where: { exit: { companyId } } });
        await tx.exitInterview.deleteMany({ where: { exit: { companyId } } });
        await tx.exitChecklistItem.deleteMany({ where: { exit: { companyId } } });
        await tx.exitApproval.deleteMany({ where: { exit: { companyId } } });
        await tx.performanceCriterionScore.deleteMany({ where: { review: { companyId } } });
        await tx.reviewCycleParticipant.deleteMany({ where: { reviewCycle: { companyId } } });
        await tx.candidateEvaluation.deleteMany({ where: { candidate: { subscriptionId: id } } });
        await tx.subscriptionEvent.deleteMany({ where: { subscriptionId: id } });
        await tx.userSession.deleteMany({ where: { user: { OR: [{ subscriptionId: id }, { companyId }] } } });
        await tx.passwordResetToken.deleteMany({ where: { user: { OR: [{ subscriptionId: id }, { companyId }] } } });

        // LEVEL 1: Relational workflow & employee child records
        await tx.supportTicket.deleteMany({ where: { OR: [{ companyId }, { company: sub.company }] } });
        await tx.expenseClaim.deleteMany({ where: { companyId } });
        await tx.taxDeclaration.deleteMany({ where: { companyId } });
        await tx.performanceReview.deleteMany({ where: { companyId } });
        await tx.performanceCriterion.deleteMany({ where: { companyId } });
        await tx.performanceGoal.deleteMany({ where: { companyId } });
        await tx.kPIDefinition.deleteMany({ where: { companyId } });
        await tx.performanceAudit.deleteMany({ where: { companyId } });
        await tx.exit.deleteMany({ where: { companyId } });
        await tx.exitChecklistTemplate.deleteMany({ where: { companyId } });
        await tx.attendanceRegularizationRequest.deleteMany({ where: { companyId } });
        await tx.attendanceSetting.deleteMany({ where: { companyId } });
        await tx.attendance.deleteMany({ where: { employee: { companyId } } });
        await tx.leaveQuota.deleteMany({ where: { employee: { companyId } } });
        await tx.jobRequisition.deleteMany({ where: { subscriptionId: id } });
        await tx.candidate.deleteMany({ where: { subscriptionId: id } });

        // LEVEL 2: Configuration & Business logs
        await tx.expenseCategory.deleteMany({ where: { companyId } });
        await tx.fiscalYear.deleteMany({ where: { companyId } });
        await tx.reviewCycle.deleteMany({ where: { companyId } });
        await tx.leaveRequest.deleteMany({ where: { companyId } });
        await tx.leaveType.deleteMany({ where: { companyId } });
        await tx.payroll.deleteMany({ where: { companyId } });
        await tx.salaryComponent.deleteMany({ where: { companyId } });
        await tx.officeTiming.deleteMany({ where: { companyId } });
        await tx.holiday.deleteMany({ where: { companyId } });
        await tx.calendarEvent.deleteMany({ where: { companyId } });
        await tx.document.deleteMany({ where: { companyId } });
        await tx.companyAsset.deleteMany({ where: { companyId } });
        await tx.companyDevice.deleteMany({ where: { companyId } });
        await tx.companySettings.deleteMany({ where: { companyId } });
        await tx.message.deleteMany({ where: { companyId } });
        await tx.auditLog.deleteMany({ where: { companyId } });
        await tx.announcement.deleteMany({ where: { subscriptionId: id } });
        await tx.invoice.deleteMany({ where: { subscriptionId: id } });
        await tx.paymentRecord.deleteMany({ where: { company: sub.company } });
        await tx.outboxIdempotency.deleteMany({ where: { companyId } });
        await tx.outboxEvent.deleteMany({ where: { companyId } });
        await tx.companyPlanAssignment.deleteMany({ where: { company: sub.company } });

        // LEVEL 3: Core directory & identity records
        await tx.employee.deleteMany({ where: { OR: [{ subscriptionId: id }, { companyId }] } });
        await tx.designation.deleteMany({ where: { OR: [{ subscriptionId: id }, { companyId }] } });
        await tx.department.deleteMany({ where: { OR: [{ subscriptionId: id }, { companyId }] } });
        await tx.role.deleteMany({ where: { companyId } });
        await tx.user.deleteMany({ where: { OR: [{ subscriptionId: id }, { companyId }] } });

        // LEVEL 4: Root tenant entities
        await tx.subscription.delete({ where: { id } });
        if (companyId) {
          await tx.company.deleteMany({ where: { id: companyId } });
        }
      },
      { maxWait: 20000, timeout: 60000 },
    );

    // 5. Post-commit storage cleanup (asynchronous & non-blocking)
    if (this.storageService) {
      const rawPaths = [
        ...documentFiles.map((d) => d.filePath),
        ...exitDocs.map((e) => e.storageKey),
        ...payrolls.map((p) => p.payslipPath),
        ...candidates.map((c) => c.resume),
        ...avatarPaths,
      ];
      const uniquePaths = Array.from(new Set(rawPaths.filter(Boolean) as string[]));

      for (const path of uniquePaths) {
        try {
          await this.storageService.deleteFile(path);
        } catch (err: any) {
          this.logger.warn(
            `[STORAGE PURGE] Failed to delete file [${path}] for company [${companyId}]: ${
              err?.message || String(err)
            }`,
          );
        }
      }
    }

    return {
      success: true,
      message: `Subscription "${sub.company}" and all associated data permanently purged.`,
    };
  }

  /**
   * Approves a pending company registration.
   * Starts trial duration at approval time using configured trialDays.
   */
  async approveCompany(id: string, performedBy: string = 'SuperAdmin') {
    return this.prisma.$transaction(async (tx) => {
      const sub = await tx.subscription.findUnique({ where: { id } });
      if (!sub) {
        throw new NotFoundException(`Company subscription with ID "${id}" not found`);
      }
      // Idempotency: if already Active or Trial, return existing
      if (sub.status === 'Active' || sub.status === 'Trial') {
        return sub;
      }
      if (
        sub.status !== 'Pending' &&
        sub.status !== 'PENDING_APPROVAL' &&
        sub.status !== 'Pending Approval'
      ) {
        throw new BadRequestException(
          `Cannot approve company with status "${sub.status}". Company must be in Pending state.`,
        );
      }

      const trialDays = this.systemConfigService
        ? await this.systemConfigService.getConfiguredTrialDays()
        : 14;
      const todayStr = getBusinessDateString();
      const expiryStr = calculateSubscriptionExpiry(
        todayStr,
        BillingCycle.TRIAL,
        trialDays,
      );

      const updated = await tx.subscription.update({
        where: { id },
        data: {
          status: 'Trial',
          start: todayStr,
          expiry: expiryStr,
        },
      });

      await tx.subscriptionEvent.create({
        data: {
          subscriptionId: id,
          event: 'Approved',
          fromStatus: sub.status,
          toStatus: 'Trial',
          performedBy,
          note: `Company registration approved by ${performedBy}. Trial initialized for ${trialDays} days.`,
        },
      });

      if (this.auditLogger) {
        await this.auditLogger
          .logAction({
            companyId: id,
            action: 'COMPANY_APPROVED',
            details: `Company "${sub.company}" approved by ${performedBy}. Trial active from ${todayStr} to ${expiryStr} (${trialDays} days).`,
          })
          .catch(() => null);
      }

      return updated;
    });
  }

  /**
   * Rejects a pending company registration.
   */
  async rejectCompany(
    id: string,
    reason?: string,
    performedBy: string = 'SuperAdmin',
  ) {
    return this.prisma.$transaction(async (tx) => {
      const sub = await tx.subscription.findUnique({ where: { id } });
      if (!sub) {
        throw new NotFoundException(`Company subscription with ID "${id}" not found`);
      }
      if (sub.status === 'Rejected') {
        return sub;
      }
      if (
        sub.status !== 'Pending' &&
        sub.status !== 'PENDING_APPROVAL' &&
        sub.status !== 'Pending Approval'
      ) {
        throw new BadRequestException(
          `Cannot reject company with status "${sub.status}". Company must be in Pending state.`,
        );
      }

      const updated = await tx.subscription.update({
        where: { id },
        data: {
          status: 'Rejected',
          suspendReason: reason || 'Company registration rejected by administrator',
        },
      });

      await tx.subscriptionEvent.create({
        data: {
          subscriptionId: id,
          event: 'Rejected',
          fromStatus: sub.status,
          toStatus: 'Rejected',
          performedBy,
          note: reason || 'Registration rejected',
        },
      });

      if (this.auditLogger) {
        await this.auditLogger
          .logAction({
            companyId: id,
            action: 'COMPANY_REJECTED',
            details: `Company "${sub.company}" registration rejected by ${performedBy}. Reason: ${reason || 'None provided'}`,
          })
          .catch(() => null);
      }

      return updated;
    });
  }

  /**
   * Idempotent scheduled reconciliation (Nightly at midnight or on-demand):
   * Identifies subscriptions where expiry < currentBusinessDate and status IN ('Trial', 'Active', 'Paid')
   * and safely transitions them to status = 'Expired'.
   */
  @Cron(
    process.env.SUBSCRIPTION_EXPIRY_RECONCILIATION_CRON ||
      CronExpression.EVERY_DAY_AT_MIDNIGHT,
  )
  async reconcileExpiredSubscriptions(): Promise<{
    updatedCount: number;
    subscriptionIds: string[];
  }> {
    const todayStr = getBusinessDateString();

    const expiredCandidates = await this.prisma.subscription.findMany({
      where: {
        expiry: {
          lt: todayStr,
        },
        status: {
          in: ['Trial', 'Active', 'Paid'],
        },
      },
      select: { id: true, company: true, status: true, expiry: true },
    });

    if (expiredCandidates.length === 0) {
      return { updatedCount: 0, subscriptionIds: [] };
    }

    const ids = expiredCandidates.map((s) => s.id);

    const result = await this.prisma.subscription.updateMany({
      where: {
        id: { in: ids },
      },
      data: {
        status: 'Expired',
      },
    });

    this.logger.log(
      `[SubscriptionReconciliation] Successfully reconciled ${result.count} expired subscriptions to 'Expired' status (today: ${todayStr}). IDs: ${ids.join(', ')}`,
    );

    return { updatedCount: result.count, subscriptionIds: ids };
  }
}

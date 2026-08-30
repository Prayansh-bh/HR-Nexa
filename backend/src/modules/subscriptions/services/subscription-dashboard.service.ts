import { Injectable } from '@nestjs/common';
import { SubscriptionsRepository } from '../repositories/subscriptions.repository';
import { PrismaService } from '../../../prisma/prisma.service';
import { SubscriptionStatus } from '../enums/subscription-status.enum';
import { getBusinessDateString } from '../../../common/utils/date.util';

@Injectable()
export class SubscriptionDashboardService {
  constructor(
    private readonly subscriptionsRepository: SubscriptionsRepository,
    private readonly prisma: PrismaService,
  ) {}

  async getEnrichedStats() {
    const [rawSubs, invoices, rawEvents] = await Promise.all([
      this.subscriptionsRepository.findAll({ isDemo: false }),
      this.prisma.invoice.findMany({
        where: {
          subscription: {
            companyRelation: {
              isDemo: false,
            },
          },
        },
      }),
      this.prisma.auditLog.findMany({
        take: 50,
        orderBy: { timestamp: 'desc' },
      }),
    ]);

    const subscriptions = Array.isArray(rawSubs) ? rawSubs : rawSubs.data;
    const paid = invoices.filter(
      (inv) => inv.status === 'Paid' || inv.status === 'Processed',
    );
    const today = getBusinessDateString();
    const cm = today.slice(0, 7);
    const cy = today.slice(0, 4);

    const in30Date = new Date();
    in30Date.setDate(in30Date.getDate() + 30);
    const in30s = getBusinessDateString(in30Date);

    // Mutually exclusive partitioning across all subscription records
    const active: any[] = [];
    const trials: any[] = [];
    const expired: any[] = [];
    const suspended: any[] = [];
    const cancelled: any[] = [];
    const other: any[] = [];

    for (const s of subscriptions) {
      const status = s.status || '';
      const isCancelled = status === SubscriptionStatus.CANCELLED;
      const isSuspended = status === SubscriptionStatus.SUSPENDED;
      const isExplicitExpired = status === SubscriptionStatus.EXPIRED;
      const isArchived = status === SubscriptionStatus.ARCHIVED;
      const isPastExpiry = s.expiry ? s.expiry < today : false;

      if (isCancelled) {
        cancelled.push(s);
      } else if (isSuspended) {
        suspended.push(s);
      } else if (isExplicitExpired || (isPastExpiry && !isArchived)) {
        expired.push(s);
      } else if (
        (status === SubscriptionStatus.ACTIVE || status === SubscriptionStatus.PAID) &&
        (!s.expiry || s.expiry >= today)
      ) {
        active.push(s);
      } else if (
        (status === SubscriptionStatus.TRIAL || s.cycle === 'Trial') &&
        (!s.expiry || s.expiry >= today)
      ) {
        trials.push(s);
      } else {
        other.push(s);
      }
    }

    const expiring = active.filter(
      (s) => s.expiry && s.expiry >= today && s.expiry <= in30s,
    );

    const totalRevenue = paid.reduce(
      (s, inv) => (inv.type === 'Refund' ? s - inv.amount : s + inv.amount),
      0,
    );
    const monthlyRevenue = paid
      .filter((inv) => inv.type !== 'Refund' && inv.date.startsWith(cm))
      .reduce((s, inv) => s + inv.amount, 0);
    const annualRevenue = paid
      .filter((inv) => inv.type !== 'Refund' && inv.date.startsWith(cy))
      .reduce((s, inv) => s + inv.amount, 0);

    const mrr = active.reduce(
      (s, sub) =>
        s + (sub.cycle === 'Annual' ? Math.round(sub.amount / 12) : sub.amount),
      0,
    );
    const arr = mrr * 12;

    const renewedCY = invoices.filter(
      (inv) => inv.id.startsWith('INV-REN-') && inv.date.startsWith(cy),
    ).length;
    const cancelledCY = cancelled.filter(
      (s) => (s as any).cancelledAt && (s as any).cancelledAt.startsWith(cy),
    ).length;
    const renewalRate =
      renewedCY + cancelledCY > 0
        ? Math.round((renewedCY / (renewedCY + cancelledCY)) * 100)
        : 100;
    const churnRate =
      subscriptions.length > 0
        ? Math.round((cancelled.length / subscriptions.length) * 100)
        : 0;

    const recentPayments = paid.slice(0, 10);
    const renewalsToday = invoices.filter(
      (inv) =>
        inv.date === today &&
        (inv.id.startsWith('INV-REN-') || inv.id.startsWith('INV-UPG-')),
    ).length;

    const filteredEvents = rawEvents.filter(
      (e) => e.action && e.action.includes('Subscription'),
    );

    const recentEvents = (filteredEvents.length > 0 ? filteredEvents : rawEvents.slice(0, 20)).map((e) => ({
      id: e.id,
      company: e.companyId || 'Platform',
      type: e.action,
      timestamp: e.timestamp.toISOString(),
      details: e.details || '',
    }));

    return {
      totalCompanies: subscriptions.length,
      activeSubscriptions: active.length,
      trialCompanies: trials.length,
      expiringIn30Days: expiring.length,
      expired: expired.length,
      suspended: suspended.length,
      cancelled: cancelled.length,
      other: other.length,
      totalRevenue,
      monthlyRevenue,
      annualRevenue,
      mrr,
      arr,
      renewalRate,
      churnRate,
      recentPayments,
      renewalsToday,
      recentEvents,
    };
  }

  async getRenewalQueue() {
    const rawResult = await this.subscriptionsRepository.findAll({ isDemo: false });
    const subscriptions = Array.isArray(rawResult) ? rawResult : rawResult.data;

    const todayStr = getBusinessDateString();
    const in30 = new Date();
    in30.setDate(in30.getDate() + 30);
    const in30Str = getBusinessDateString(in30);

    return subscriptions
      .filter(
        (s) =>
          (s.status === SubscriptionStatus.ACTIVE || s.status === SubscriptionStatus.PAID) &&
          s.expiry &&
          s.expiry >= todayStr &&
          s.expiry <= in30Str,
      )
      .map((s) => {
        const daysLeft = Math.ceil(
          (new Date(s.expiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
        );
        return {
          ...s,
          daysLeft,
        };
      });
  }
}

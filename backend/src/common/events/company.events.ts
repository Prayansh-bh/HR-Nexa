/**
 * Company & Subscription Domain Events
 */

export class CompanyCreatedEvent {
  constructor(
    public readonly companyId: string,
    public readonly companyName: string,
    public readonly plan: string,
    public readonly status: string,
    public readonly ownerEmail?: string,
    public readonly timestamp: string = new Date().toISOString(),
  ) {}
}

export class CompanyUpdatedEvent {
  constructor(
    public readonly companyId: string,
    public readonly companyName: string,
    public readonly changes: Record<string, any>,
    public readonly timestamp: string = new Date().toISOString(),
  ) {}
}

export class CompanyActivatedEvent {
  constructor(
    public readonly companyId: string,
    public readonly companyName: string,
    public readonly timestamp: string = new Date().toISOString(),
  ) {}
}

export class CompanySuspendedEvent {
  constructor(
    public readonly companyId: string,
    public readonly companyName: string,
    public readonly reason?: string,
    public readonly timestamp: string = new Date().toISOString(),
  ) {}
}

export class CompanyDeletedEvent {
  constructor(
    public readonly companyId: string,
    public readonly companyName: string,
    public readonly timestamp: string = new Date().toISOString(),
  ) {}
}

export class SubscriptionCreatedEvent {
  constructor(
    public readonly subscriptionId: string,
    public readonly companyId: string,
    public readonly plan: string,
    public readonly status: string,
    public readonly timestamp: string = new Date().toISOString(),
  ) {}
}

export class SubscriptionUpdatedEvent {
  constructor(
    public readonly subscriptionId: string,
    public readonly companyId: string,
    public readonly changes: Record<string, any>,
    public readonly timestamp: string = new Date().toISOString(),
  ) {}
}

export class SubscriptionRenewedEvent {
  constructor(
    public readonly subscriptionId: string,
    public readonly companyId: string,
    public readonly expiryDate: string,
    public readonly timestamp: string = new Date().toISOString(),
  ) {}
}

export class SubscriptionExpiredEvent {
  constructor(
    public readonly subscriptionId: string,
    public readonly companyId: string,
    public readonly timestamp: string = new Date().toISOString(),
  ) {}
}

export class PlanChangedEvent {
  constructor(
    public readonly subscriptionId: string,
    public readonly companyId: string,
    public readonly oldPlan: string,
    public readonly newPlan: string,
    public readonly timestamp: string = new Date().toISOString(),
  ) {}
}

export class BillingUpdatedEvent {
  constructor(
    public readonly subscriptionId: string,
    public readonly companyId: string,
    public readonly billingStatus: string,
    public readonly timestamp: string = new Date().toISOString(),
  ) {}
}

export class SeatCountUpdatedEvent {
  constructor(
    public readonly subscriptionId: string,
    public readonly companyId: string,
    public readonly usedSeats: number,
    public readonly purchasedSeats: number,
    public readonly timestamp: string = new Date().toISOString(),
  ) {}
}

export class CompanyStatisticsUpdatedEvent {
  constructor(
    public readonly subscriptionId: string,
    public readonly companyId: string,
    public readonly employeesCount: number,
    public readonly usedSeats: number,
    public readonly timestamp: string = new Date().toISOString(),
  ) {}
}

export class EmployeeCountUpdatedEvent {
  constructor(
    public readonly subscriptionId: string,
    public readonly companyId: string,
    public readonly employeesCount: number,
    public readonly timestamp: string = new Date().toISOString(),
  ) {}
}

export class EmployeeCountChangedEvent {
  constructor(
    public readonly companyId: string,
    public readonly source: string,
    public readonly timestamp: string = new Date().toISOString(),
  ) {}
}

export const EMPLOYEE_COUNT_SYNC_LOCK_ID = 987654;

export const COMPANY_EVENTS = {
  CREATED: 'company.created',
  UPDATED: 'company.updated',
  ACTIVATED: 'company.activated',
  SUSPENDED: 'company.suspended',
  DELETED: 'company.deleted',
  SUBSCRIPTION_CREATED: 'subscription.created',
  SUBSCRIPTION_UPDATED: 'subscription.updated',
  SUBSCRIPTION_RENEWED: 'subscription.renewed',
  SUBSCRIPTION_EXPIRED: 'subscription.expired',
  PLAN_CHANGED: 'plan.changed',
  BILLING_UPDATED: 'billing.updated',
  SEAT_COUNT_UPDATED: 'seat_count.updated',
  STATS_UPDATED: 'company_stats.updated',
  EMPLOYEE_COUNT_UPDATED: 'employee_count.updated',
  EMPLOYEE_COUNT_CHANGED: 'employee_count.changed',
} as const;

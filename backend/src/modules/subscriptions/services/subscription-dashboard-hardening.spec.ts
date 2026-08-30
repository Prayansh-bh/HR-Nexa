import { SubscriptionDashboardService } from './subscription-dashboard.service';
import { SubscriptionStatus } from '../enums/subscription-status.enum';
import * as dateUtil from '../../../common/utils/date.util';

describe('SubscriptionDashboardService - Hardened Metric & Partition Specs', () => {
  let service: SubscriptionDashboardService;
  let mockRepo: any;
  let mockPrisma: any;

  beforeEach(() => {
    mockRepo = {
      findAll: jest.fn(),
    };
    mockPrisma = {
      invoice: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      auditLog: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    service = new SubscriptionDashboardService(mockRepo, mockPrisma);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('1. Active + expired overlap: Expired Active subscription must count ONLY as expired, NOT active', async () => {
    jest.spyOn(dateUtil, 'getBusinessDateString').mockReturnValue('2026-08-16');

    const subscriptions = [
      { id: 'SUB-1', status: 'Active', expiry: '2026-08-01', cycle: 'Monthly', amount: 999 }, // Past expiry -> Expired
      { id: 'SUB-2', status: 'Active', expiry: '2026-08-30', cycle: 'Monthly', amount: 999 }, // Future expiry -> Active
    ];
    mockRepo.findAll.mockResolvedValue(subscriptions);

    const stats = await service.getEnrichedStats();
    expect(stats.totalCompanies).toBe(2);
    expect(stats.activeSubscriptions).toBe(1);
    expect(stats.expired).toBe(1);
    expect(stats.activeSubscriptions + stats.expired + stats.trialCompanies + stats.suspended + stats.cancelled + stats.other).toBe(stats.totalCompanies);
  });

  it('2. Trial + expired overlap: Expired Trial subscription must count ONLY as expired, NOT trial', async () => {
    jest.spyOn(dateUtil, 'getBusinessDateString').mockReturnValue('2026-08-16');

    const subscriptions = [
      { id: 'SUB-T1', status: 'Trial', expiry: '2026-08-05', cycle: 'Trial', amount: 0 }, // Past expiry -> Expired
      { id: 'SUB-T2', status: 'Trial', expiry: '2026-08-25', cycle: 'Trial', amount: 0 }, // Future expiry -> Trial
    ];
    mockRepo.findAll.mockResolvedValue(subscriptions);

    const stats = await service.getEnrichedStats();
    expect(stats.totalCompanies).toBe(2);
    expect(stats.trialCompanies).toBe(1);
    expect(stats.expired).toBe(1);
    expect(stats.activeSubscriptions).toBe(0);
    expect(stats.trialCompanies + stats.expired + stats.activeSubscriptions + stats.suspended + stats.cancelled + stats.other).toBe(stats.totalCompanies);
  });

  it('3. Cancelled subscription: Must count ONLY as cancelled even if expiry is in past or future', async () => {
    jest.spyOn(dateUtil, 'getBusinessDateString').mockReturnValue('2026-08-16');

    const subscriptions = [
      { id: 'SUB-C1', status: 'Cancelled', expiry: '2026-08-01', cycle: 'Monthly', amount: 500 },
      { id: 'SUB-C2', status: 'Cancelled', expiry: '2026-09-01', cycle: 'Monthly', amount: 500 },
    ];
    mockRepo.findAll.mockResolvedValue(subscriptions);

    const stats = await service.getEnrichedStats();
    expect(stats.totalCompanies).toBe(2);
    expect(stats.cancelled).toBe(2);
    expect(stats.expired).toBe(0);
    expect(stats.activeSubscriptions).toBe(0);
    expect(stats.cancelled + stats.activeSubscriptions + stats.trialCompanies + stats.expired + stats.suspended + stats.other).toBe(stats.totalCompanies);
  });

  it('4. Suspended subscription: Must count ONLY as suspended even if expiry is in the past', async () => {
    jest.spyOn(dateUtil, 'getBusinessDateString').mockReturnValue('2026-08-16');

    const subscriptions = [
      { id: 'SUB-S1', status: 'Suspended', expiry: '2026-08-01', cycle: 'Monthly', amount: 1500 },
    ];
    mockRepo.findAll.mockResolvedValue(subscriptions);

    const stats = await service.getEnrichedStats();
    expect(stats.totalCompanies).toBe(1);
    expect(stats.suspended).toBe(1);
    expect(stats.expired).toBe(0);
    expect(stats.activeSubscriptions).toBe(0);
  });

  it('5. Pending and Draft subscriptions: Explicitly categorized in other/pending without silent loss', async () => {
    jest.spyOn(dateUtil, 'getBusinessDateString').mockReturnValue('2026-08-16');

    const subscriptions = [
      { id: 'SUB-P1', status: 'Pending', expiry: '2026-09-01', cycle: 'Monthly', amount: 1000 },
      { id: 'SUB-P2', status: 'Draft', expiry: '2026-09-01', cycle: 'Monthly', amount: 1000 },
    ];
    mockRepo.findAll.mockResolvedValue(subscriptions);

    const stats = await service.getEnrichedStats();
    expect(stats.totalCompanies).toBe(2);
    expect(stats.other).toBe(2);
    expect(stats.activeSubscriptions + stats.trialCompanies + stats.expired + stats.suspended + stats.cancelled + stats.other).toBe(stats.totalCompanies);
  });

  it('6. Strict Mutually Exclusive Status Partition Invariant', async () => {
    jest.spyOn(dateUtil, 'getBusinessDateString').mockReturnValue('2026-08-16');

    const subscriptions = [
      { id: 'SUB-1', status: 'Active', expiry: '2026-08-20', cycle: 'Monthly', amount: 999 },    // Active
      { id: 'SUB-2', status: 'Paid', expiry: '2026-08-25', cycle: 'Monthly', amount: 999 },      // Active
      { id: 'SUB-3', status: 'Active', expiry: '2026-08-10', cycle: 'Monthly', amount: 999 },    // Expired
      { id: 'SUB-4', status: 'Trial', expiry: '2026-08-22', cycle: 'Trial', amount: 0 },        // Trial
      { id: 'SUB-5', status: 'Trial', expiry: '2026-08-02', cycle: 'Trial', amount: 0 },        // Expired
      { id: 'SUB-6', status: 'Suspended', expiry: '2026-08-10', cycle: 'Monthly', amount: 500 }, // Suspended
      { id: 'SUB-7', status: 'Cancelled', expiry: '2026-08-10', cycle: 'Monthly', amount: 500 }, // Cancelled
      { id: 'SUB-8', status: 'Pending', expiry: '2026-09-01', cycle: 'Monthly', amount: 500 },   // Other
    ];
    mockRepo.findAll.mockResolvedValue(subscriptions);

    const stats = await service.getEnrichedStats();
    expect(stats.totalCompanies).toBe(8);
    expect(stats.activeSubscriptions).toBe(2);
    expect(stats.trialCompanies).toBe(1);
    expect(stats.expired).toBe(2);
    expect(stats.suspended).toBe(1);
    expect(stats.cancelled).toBe(1);
    expect(stats.other).toBe(1);

    // Sum invariant
    const sum =
      stats.activeSubscriptions +
      stats.trialCompanies +
      stats.expired +
      stats.suspended +
      stats.cancelled +
      stats.other;
    expect(sum).toBe(stats.totalCompanies);
  });

  it('7. Renewal Queue: Strictly returns valid active/paid subscriptions expiring in 30-day window', async () => {
    jest.spyOn(dateUtil, 'getBusinessDateString').mockImplementation((d) => {
      if (!d) return '2026-08-16';
      // 30 days ahead
      return '2026-09-15';
    });

    const subscriptions = [
      { id: 'SUB-1', status: 'Active', expiry: '2026-08-20' }, // In window (4 days left)
      { id: 'SUB-2', status: 'Active', expiry: '2026-08-10' }, // Already expired -> Excluded
      { id: 'SUB-3', status: 'Active', expiry: '2026-09-30' }, // >30 days away -> Excluded
      { id: 'SUB-4', status: 'Cancelled', expiry: '2026-08-20' }, // Cancelled -> Excluded
    ];
    mockRepo.findAll.mockResolvedValue(subscriptions);

    const queue = await service.getRenewalQueue();
    expect(queue.length).toBe(1);
    expect(queue[0].id).toBe('SUB-1');
  });
});

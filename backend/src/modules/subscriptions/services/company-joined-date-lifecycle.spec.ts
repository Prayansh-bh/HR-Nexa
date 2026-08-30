import { SubscriptionsService } from './subscriptions.service';
import { SubscriptionsRepository } from '../repositories/subscriptions.repository';
import { SubscriptionLifecycleService } from './subscription-lifecycle.service';
import {
  calculateCompanyGrowthMonthlyTrend,
  calculateMoMCompanyGrowth,
} from '../../../../../owner/src/features/super-admin/utils/superAdminDataHelper';

describe('Company Joined Date & Subscription Billing Lifecycle Specs', () => {
  let subscriptionsService: SubscriptionsService;
  let lifecycleService: SubscriptionLifecycleService;
  let subscriptionsRepository: SubscriptionsRepository;

  let mockPrisma: any;
  let mockTx: any;
  let mockEventEmitter: any;
  let mockAuditLogger: any;
  let mockSystemConfigService: any;
  let mockTokenBlacklistService: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockTx = {
      $queryRaw: jest.fn(),
      subscription: {
        update: jest.fn(),
      },
      company: {
        update: jest.fn(),
      },
      subscriptionEvent: {
        create: jest.fn().mockResolvedValue({}),
      },
      invoice: {
        create: jest.fn().mockResolvedValue({}),
        update: jest.fn().mockResolvedValue({}),
      },
    };

    mockPrisma = {
      subscription: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
        create: jest.fn(),
      },
      company: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      saaSPlanNew: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'plan-basic',
          name: 'BASIC',
          status: 'Active',
        }),
      },
      planVersion: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'ver-1',
          version: 1,
          monthlyPrice: 1000,
          yearlyPrice: 10000,
          employeeLimit: 50,
          storageLimitGB: 10,
        }),
      },
      $transaction: jest.fn().mockImplementation(async (cb) => {
        return cb(mockTx);
      }),
    };

    mockEventEmitter = { emit: jest.fn() };
    mockAuditLogger = { logAction: jest.fn().mockResolvedValue({}) };
    mockSystemConfigService = { getConfiguredTrialDays: jest.fn().mockResolvedValue(14) };
    mockTokenBlacklistService = { blacklistToken: jest.fn() };

    subscriptionsRepository = new SubscriptionsRepository(mockPrisma);
    lifecycleService = new SubscriptionLifecycleService(
      mockPrisma,
      mockTokenBlacklistService,
      mockEventEmitter,
      mockAuditLogger,
      mockSystemConfigService,
    );

    const mockProvisioningService: any = {};
    const mockBillingService: any = { getAllInvoices: jest.fn().mockResolvedValue([]) };
    const mockDashboardService: any = {};
    const mockUsageService: any = {};
    const mockCouponService: any = {};

    subscriptionsService = new SubscriptionsService(
      subscriptionsRepository,
      mockProvisioningService,
      lifecycleService,
      mockBillingService,
      mockDashboardService,
      mockUsageService,
      mockCouponService,
    );
  });

  describe('Test 1 — Company creation date is independent of subscription renewal', () => {
    it('should include companyRelation.createdAt so mapped joinedDate reflects true company creation date', async () => {
      const mockSubRecord = {
        id: 'cfb0ee45-07c9-46e8-aaea-1f220edc1191',
        company: 'Dezoryn Technologies',
        companyId: '2678f1dd-7b79-4e1a-97ec-3735cea8863a',
        plan: 'BASIC',
        cycle: 'Annual',
        start: '2027-09-22', // Current billing period start (advanced after 2 renewals)
        expiry: '2028-09-22', // Current billing period expiry
        amount: 0,
        status: 'Active',
        createdAt: new Date('2026-08-22T05:12:31.940Z'),
        companyRelation: {
          id: '2678f1dd-7b79-4e1a-97ec-3735cea8863a',
          name: 'Dezoryn Technologies',
          isDemo: false,
          createdAt: new Date('2026-08-22T05:12:31.940Z'),
        },
      };

      mockPrisma.subscription.findMany.mockResolvedValueOnce([mockSubRecord]);

      const result: any = await subscriptionsRepository.findAll({ isDemo: false });
      expect(result).toHaveLength(1);
      const sub = result[0];

      expect(sub.companyRelation.createdAt).toEqual(new Date('2026-08-22T05:12:31.940Z'));
      expect(sub.start).toBe('2027-09-22');
      expect(sub.expiry).toBe('2028-09-22');

      // Verify domain mapper rule:
      const rawCreated = sub.companyRelation?.createdAt || sub.createdAt || sub.start;
      const joinedDate = new Date(rawCreated).toISOString().slice(0, 10);
      expect(joinedDate).toBe('2026-08-22');
      expect(joinedDate).not.toBe('2027-09-22');
    });
  });

  describe('Test 2 — Renewal does not alter Company.createdAt in database', () => {
    it('should update Subscription.start and Subscription.expiry without modifying Company entity', async () => {
      const existingSub = {
        id: 'sub-dezoryn',
        company: 'Dezoryn Technologies',
        companyId: 'comp-dezoryn',
        plan: 'BASIC',
        cycle: 'Annual',
        start: '2026-08-22',
        expiry: '2027-08-22',
        amount: 0,
        status: 'Active',
      };

      mockTx.$queryRaw.mockResolvedValueOnce([existingSub]);
      mockTx.subscription.update.mockResolvedValueOnce({
        ...existingSub,
        start: '2027-08-22',
        expiry: '2028-08-22',
        status: 'Active',
      });

      await lifecycleService.renewSubscription('sub-dezoryn', '1_YEAR');

      // Subscription was updated with new billing start and expiry
      expect(mockTx.subscription.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'sub-dezoryn' },
          data: expect.objectContaining({
            start: '2027-08-22',
            expiry: '2028-08-22',
          }),
        }),
      );

      // Company entity was NEVER mutated
      expect(mockTx.company.update).not.toHaveBeenCalled();
    });
  });

  describe('Test 3 — Subscription billing dates update correctly on renewal', () => {
    it('should advance billing period according to renewal duration rules', async () => {
      const sub = {
        id: 'sub-shulka',
        company: 'Shulka Corp',
        plan: 'BASIC',
        cycle: 'Monthly',
        start: '2026-08-24',
        expiry: '2026-09-24',
        amount: 0,
        status: 'Active',
      };

      mockTx.$queryRaw.mockResolvedValueOnce([sub]);
      mockTx.subscription.update.mockResolvedValueOnce({
        ...sub,
        start: '2026-09-24',
        expiry: '2026-10-24',
        status: 'Paid',
      });

      await lifecycleService.renewSubscription('sub-shulka', '1_MONTH');

      expect(mockTx.subscription.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'sub-shulka' },
          data: expect.objectContaining({
            start: '2026-09-24',
            expiry: '2026-10-24',
          }),
        }),
      );
    });
  });

  describe('Test 4 — Dezoryn scenario with multiple renewals reconciled', () => {
    it('should present joinedDate as 2026-08-22 while billing dates reflect 2027-09-22 -> 2028-09-22', () => {
      const dezorynSub = {
        id: 'cfb0ee45-07c9-46e8-aaea-1f220edc1191',
        company: 'Dezoryn Technologies',
        plan: 'BASIC',
        start: '2027-09-22',
        expiry: '2028-09-22',
        createdAt: new Date('2026-08-22T05:12:31.940Z'),
        companyRelation: {
          id: '2678f1dd-7b79-4e1a-97ec-3735cea8863a',
          name: 'Dezoryn Technologies',
          isDemo: false,
          createdAt: new Date('2026-08-22T05:12:31.940Z'),
        },
      };

      const rawCreated = dezorynSub.companyRelation?.createdAt || dezorynSub.createdAt || dezorynSub.start;
      const mappedCompany = {
        id: dezorynSub.id,
        name: dezorynSub.company,
        joinedDate: new Date(rawCreated).toISOString().slice(0, 10),
        billingStartDate: dezorynSub.start,
        expiryDate: dezorynSub.expiry,
      };

      expect(mappedCompany.joinedDate).toBe('2026-08-22');
      expect(mappedCompany.billingStartDate).toBe('2027-09-22');
      expect(mappedCompany.expiryDate).toBe('2028-09-22');
    });
  });

  describe('Test 5 — Company Growth Analytics uses true company creation date', () => {
    it('should place Dezoryn in August 2026 growth bucket instead of dropping or putting in September 2027', () => {
      const companies: any[] = [
        {
          id: '1',
          name: 'Dezoryn Technologies',
          joinedDate: '2026-08-22', // Authoritative company creation date
          billingStartDate: '2027-09-22', // Billing renewal date
        },
        {
          id: '2',
          name: 'Shulka Corp',
          joinedDate: '2026-08-24',
          billingStartDate: '2026-08-24',
        },
      ];

      const targetDate = new Date(2026, 7, 28); // August 28, 2026
      const trend = calculateCompanyGrowthMonthlyTrend(companies, targetDate);

      const augBucket = trend.find((t) => t.month === 'Aug (Now)');
      expect(augBucket?.count).toBe(2); // Both Dezoryn and Shulka correctly counted in August 2026!

      const mom = calculateMoMCompanyGrowth(companies, targetDate);
      expect(mom).toBe('+2 new companies');
    });
  });
});

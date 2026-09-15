import { NotFoundException, BadRequestException } from '@nestjs/common';
import {
  SubscriptionLifecycleService,
  normalizeRenewalDuration,
} from './subscription-lifecycle.service';
import { getBusinessDateString } from '../../../common/utils/date.util';
import { SubscriptionStatus } from '../enums/subscription-status.enum';
import { BillingCycle } from '../enums/billing-cycle.enum';

describe('SubscriptionLifecycleService - renewSubscription & Duration Specs (P0 Remediation)', () => {
  let service: SubscriptionLifecycleService;
  let mockPrisma: any;
  let mockTx: any;
  let mockEventEmitter: any;
  let mockAuditLogger: any;
  let mockSystemConfigService: any;
  let mockTokenBlacklistService: any;

  beforeEach(() => {
    mockTx = {
      $queryRaw: jest.fn(),
      saaSPlanNew: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'PLAN-PRO',
          name: 'Professional',
          status: 'Active',
        }),
      },
      planVersion: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'VER-1',
          version: 1,
          monthlyPrice: 4999,
          yearlyPrice: 49990,
          employeeLimit: 50,
          storageLimitGB: 50,
        }),
      },
      invoice: {
        create: jest.fn().mockResolvedValue({ id: 'INV-1' }),
        update: jest.fn().mockResolvedValue({ id: 'INV-1', status: 'Paid' }),
      },
      subscription: {
        update: jest.fn().mockImplementation((args) => ({
          id: args.where.id,
          ...args.data,
        })),
      },
      subscriptionEvent: {
        create: jest.fn().mockResolvedValue({}),
      },
    };

    mockPrisma = {
      $transaction: jest.fn().mockImplementation(async (cb) => {
        return cb(mockTx);
      }),
      subscription: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      saaSPlanNew: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'PLAN-PRO',
          name: 'Professional',
          status: 'Active',
        }),
        findFirst: jest.fn().mockResolvedValue({
          id: 'PLAN-PRO',
          name: 'Professional',
          status: 'Active',
        }),
      },
      planVersion: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'VER-1',
          version: 1,
          monthlyPrice: 4999,
          yearlyPrice: 49990,
          employeeLimit: 50,
          storageLimitGB: 50,
        }),
      },
    };

    mockEventEmitter = { emit: jest.fn() };
    mockAuditLogger = { logAction: jest.fn().mockResolvedValue({}) };
    mockSystemConfigService = { getConfiguredTrialDays: jest.fn().mockResolvedValue(14) };
    mockTokenBlacklistService = { blacklistToken: jest.fn() };

    service = new SubscriptionLifecycleService(
      mockPrisma,
      mockTokenBlacklistService,
      mockEventEmitter,
      mockAuditLogger,
      mockSystemConfigService,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('normalizeRenewalDuration helper', () => {
    it('normalizes 14_DAYS representations', () => {
      expect(normalizeRenewalDuration('14_DAYS')).toEqual({
        normalizedDuration: '14_DAYS',
        cycle: BillingCycle.TRIAL,
      });
      expect(normalizeRenewalDuration('14 Days')).toEqual({
        normalizedDuration: '14_DAYS',
        cycle: BillingCycle.TRIAL,
      });
      expect(normalizeRenewalDuration('Trial')).toEqual({
        normalizedDuration: '14_DAYS',
        cycle: BillingCycle.TRIAL,
      });
    });

    it('normalizes 1_MONTH representations', () => {
      expect(normalizeRenewalDuration('1_MONTH')).toEqual({
        normalizedDuration: '1_MONTH',
        cycle: BillingCycle.MONTHLY,
      });
      expect(normalizeRenewalDuration('1 Month')).toEqual({
        normalizedDuration: '1_MONTH',
        cycle: BillingCycle.MONTHLY,
      });
      expect(normalizeRenewalDuration('Monthly')).toEqual({
        normalizedDuration: '1_MONTH',
        cycle: BillingCycle.MONTHLY,
      });
    });

    it('normalizes 1_YEAR representations', () => {
      expect(normalizeRenewalDuration('1_YEAR')).toEqual({
        normalizedDuration: '1_YEAR',
        cycle: BillingCycle.ANNUAL,
      });
      expect(normalizeRenewalDuration('1 Year')).toEqual({
        normalizedDuration: '1_YEAR',
        cycle: BillingCycle.ANNUAL,
      });
      expect(normalizeRenewalDuration('Annual')).toEqual({
        normalizedDuration: '1_YEAR',
        cycle: BillingCycle.ANNUAL,
      });
    });

    it('falls back to existing subscription cycle when duration is undefined/empty', () => {
      expect(normalizeRenewalDuration(undefined, 'Annual')).toEqual({
        normalizedDuration: '1_YEAR',
        cycle: BillingCycle.ANNUAL,
      });
      expect(normalizeRenewalDuration('', 'Monthly')).toEqual({
        normalizedDuration: '1_MONTH',
        cycle: BillingCycle.MONTHLY,
      });
      expect(normalizeRenewalDuration(undefined, 'Trial')).toEqual({
        normalizedDuration: '14_DAYS',
        cycle: BillingCycle.TRIAL,
      });
    });

    it('throws BadRequestException for unsupported duration values', () => {
      expect(() => normalizeRenewalDuration('5_YEARS')).toThrow(BadRequestException);
      expect(() => normalizeRenewalDuration('invalid')).toThrow(BadRequestException);
    });
  });

  describe('renewSubscription scenarios', () => {
    const todayStr = getBusinessDateString();

    it('1. Active subscription + 14 days renewal (courtesy extension)', async () => {
      mockTx.$queryRaw.mockResolvedValue([
        {
          id: 'SUB-ACT-14',
          company: 'Acme Active',
          plan: 'Professional',
          status: 'Active',
          expiry: '2026-12-01',
          cycle: 'Monthly',
        },
      ]);

      const result = await service.renewSubscription('SUB-ACT-14', '14_DAYS');

      expect(mockTx.subscription.update).toHaveBeenCalledWith({
        where: { id: 'SUB-ACT-14' },
        data: expect.objectContaining({
          start: '2026-12-01',
          expiry: '2026-12-15',
          amount: 0,
          cycle: BillingCycle.TRIAL,
        }),
      });
      expect(result.expiry).toBe('2026-12-15');
      expect(mockTx.invoice.create).not.toHaveBeenCalled();
    });

    it('2. Active subscription + 1 month renewal creates invoice and advances 1 month', async () => {
      mockTx.$queryRaw.mockResolvedValue([
        {
          id: 'SUB-ACT-1M',
          company: 'Acme Monthly',
          plan: 'Professional',
          status: 'Active',
          expiry: '2026-12-01',
          cycle: 'Monthly',
        },
      ]);

      const result = await service.renewSubscription('SUB-ACT-1M', '1_MONTH');

      expect(mockTx.subscription.update).toHaveBeenCalledWith({
        where: { id: 'SUB-ACT-1M' },
        data: expect.objectContaining({
          start: '2026-12-01',
          expiry: '2027-01-01',
          amount: 4999,
          cycle: BillingCycle.MONTHLY,
          status: SubscriptionStatus.PAID,
        }),
      });
      expect(mockTx.invoice.create).toHaveBeenCalled();
      expect(mockTx.invoice.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: 'Paid' } }),
      );
      expect(result.expiry).toBe('2027-01-01');
    });

    it('3. Active subscription + 1 year renewal advances 1 calendar year', async () => {
      mockTx.$queryRaw.mockResolvedValue([
        {
          id: 'SUB-ACT-1Y',
          company: 'Acme Yearly',
          plan: 'Professional',
          status: 'Active',
          expiry: '2026-12-01',
          cycle: 'Annual',
        },
      ]);

      const result = await service.renewSubscription('SUB-ACT-1Y', '1_YEAR');

      expect(mockTx.subscription.update).toHaveBeenCalledWith({
        where: { id: 'SUB-ACT-1Y' },
        data: expect.objectContaining({
          start: '2026-12-01',
          expiry: '2027-12-01',
          amount: 49990,
          cycle: BillingCycle.ANNUAL,
          status: SubscriptionStatus.ACTIVE,
        }),
      });
      expect(result.expiry).toBe('2027-12-01');
    });

    it('4. Expired yesterday + 14 days renewal anchors to today (never stays in the past)', async () => {
      mockTx.$queryRaw.mockResolvedValue([
        {
          id: 'SUB-EXP-14',
          company: 'Acme Expired Yesterday',
          plan: 'Professional',
          status: 'Expired',
          expiry: '2025-01-01',
          cycle: 'Trial',
        },
      ]);

      const result = await service.renewSubscription('SUB-EXP-14', '14_DAYS');

      expect(result.start).toBe(todayStr);
      expect(result.expiry > todayStr).toBe(true);
    });

    it('5. Expired yesterday + 1 month renewal anchors to today', async () => {
      mockTx.$queryRaw.mockResolvedValue([
        {
          id: 'SUB-EXP-1M',
          company: 'Acme Expired 1M',
          plan: 'Professional',
          status: 'Expired',
          expiry: '2025-01-01',
          cycle: 'Monthly',
        },
      ]);

      const result = await service.renewSubscription('SUB-EXP-1M', '1_MONTH');

      expect(result.start).toBe(todayStr);
      expect(result.expiry > todayStr).toBe(true);
      expect(mockTx.invoice.create).toHaveBeenCalled();
    });

    it('6. Expired months ago + 1 month renewal anchors strictly to max(sub.expiry, today)', async () => {
      mockTx.$queryRaw.mockResolvedValue([
        {
          id: 'SUB-OLD-EXP-1M',
          company: 'Acme Ancient Expired',
          plan: 'Professional',
          status: 'Expired',
          expiry: '2024-06-01',
          cycle: 'Monthly',
        },
      ]);

      const result = await service.renewSubscription('SUB-OLD-EXP-1M', '1_MONTH');

      expect(result.start).toBe(todayStr);
      expect(result.expiry > todayStr).toBe(true);
    });

    it('7. Expired months ago + 1 year renewal anchors to today', async () => {
      mockTx.$queryRaw.mockResolvedValue([
        {
          id: 'SUB-OLD-EXP-1Y',
          company: 'Acme Ancient Expired 1Y',
          plan: 'Professional',
          status: 'Expired',
          expiry: '2024-06-01',
          cycle: 'Annual',
        },
      ]);

      const result = await service.renewSubscription('SUB-OLD-EXP-1Y', '1_YEAR');

      expect(result.start).toBe(todayStr);
      expect(result.expiry > todayStr).toBe(true);
    });

    it('8. Throws NotFoundException if subscription does not exist', async () => {
      mockTx.$queryRaw.mockResolvedValue([]);

      await expect(service.renewSubscription('NON-EXISTENT-SUB')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('9. Throws BadRequestException if subscription is Archived or Deleted', async () => {
      mockTx.$queryRaw.mockResolvedValue([
        {
          id: 'SUB-ARCH',
          company: 'Archived Corp',
          status: 'Archived',
          plan: 'Professional',
        },
      ]);

      await expect(service.renewSubscription('SUB-ARCH', '1_MONTH')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('10. Emits domain event and audit log on renewal', async () => {
      mockTx.$queryRaw.mockResolvedValue([
        {
          id: 'SUB-EVENT-TEST',
          company: 'Event Test Corp',
          plan: 'Professional',
          status: 'Active',
          expiry: '2026-09-01',
          cycle: 'Monthly',
        },
      ]);

      await service.renewSubscription('SUB-EVENT-TEST', '1_MONTH');

      expect(mockEventEmitter.emit).toHaveBeenCalled();
      expect(mockAuditLogger.logAction).toHaveBeenCalledWith(
        expect.objectContaining({
          companyId: 'SUB-EVENT-TEST',
          action: 'Subscription Renewed',
        }),
      );
    });
  });
});

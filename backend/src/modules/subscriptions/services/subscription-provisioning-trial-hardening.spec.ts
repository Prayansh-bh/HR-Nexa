import { SubscriptionProvisioningService } from './subscription-provisioning.service';
import { SubscriptionStatus } from '../enums/subscription-status.enum';
import { BillingCycle } from '../enums/billing-cycle.enum';
import * as dateUtil from '../../../common/utils/date.util';
import { calculateSubscriptionExpiry } from '../../../common/utils/date.util';

describe('Subscription Expiry Date & Trial Flow Hardening Specs', () => {
  describe('calculateSubscriptionExpiry Unit Specs', () => {
    it('Scenario A: Trial custom start (2026-09-01 + 14 days -> 2026-09-15)', () => {
      const expiry = calculateSubscriptionExpiry('2026-09-01', BillingCycle.TRIAL, 14);
      expect(expiry).toBe('2026-09-15');
    });

    it('Scenario B: Monthly Jan 31 non-leap year (2026-01-31 -> 2026-02-28 without March overflow)', () => {
      const expiry = calculateSubscriptionExpiry('2026-01-31', BillingCycle.MONTHLY);
      expect(expiry).toBe('2026-02-28');
    });

    it('Scenario C: Monthly leap-year Jan 31 (2028-01-31 -> 2028-02-29)', () => {
      const expiry = calculateSubscriptionExpiry('2028-01-31', BillingCycle.MONTHLY);
      expect(expiry).toBe('2028-02-29');
    });

    it('Scenario D: Annual Feb 29 leap-year start (2024-02-29 -> 2025-02-28)', () => {
      const expiry = calculateSubscriptionExpiry('2024-02-29', BillingCycle.ANNUAL);
      expect(expiry).toBe('2025-02-28');
    });

    it('Scenario E: Year wrap for December (2026-12-31 -> 2027-01-31)', () => {
      const expiry = calculateSubscriptionExpiry('2026-12-31', BillingCycle.MONTHLY);
      expect(expiry).toBe('2027-01-31');
    });

    it('Scenario F: 31-day month to 30-day month (2026-08-31 -> 2026-09-30)', () => {
      const expiry = calculateSubscriptionExpiry('2026-08-31', BillingCycle.MONTHLY);
      expect(expiry).toBe('2026-09-30');
    });

    it('Scenario G: Strict Calendar Validation - Invalid month rejected (2026-13-01)', () => {
      expect(() =>
        calculateSubscriptionExpiry('2026-13-01', BillingCycle.TRIAL, 14),
      ).toThrow('out of valid calendar range');
    });

    it('Scenario H: Strict Calendar Validation - Month zero rejected (2026-00-10)', () => {
      expect(() =>
        calculateSubscriptionExpiry('2026-00-10', BillingCycle.TRIAL, 14),
      ).toThrow('out of valid calendar range');
    });

    it('Scenario I: Strict Calendar Validation - Invalid February date (2026-02-30)', () => {
      expect(() =>
        calculateSubscriptionExpiry('2026-02-30', BillingCycle.TRIAL, 14),
      ).toThrow('month 2 only has 28 days');
    });

    it('Scenario J: Strict Calendar Validation - Leap-year February 29 valid (2028-02-29)', () => {
      const expiry = calculateSubscriptionExpiry('2028-02-29', BillingCycle.TRIAL, 14);
      expect(expiry).toBe('2028-03-14');
    });

    it('Scenario K: Strict Calendar Validation - Non-leap-year February 29 invalid (2027-02-29)', () => {
      expect(() =>
        calculateSubscriptionExpiry('2027-02-29', BillingCycle.TRIAL, 14),
      ).toThrow('month 2 only has 28 days');
    });

    it('Scenario L: Strict Calendar Validation - Malformed format rejected', () => {
      expect(() => calculateSubscriptionExpiry('not-a-date', BillingCycle.MONTHLY)).toThrow(
        'Expected YYYY-MM-DD',
      );
      expect(() => calculateSubscriptionExpiry('2026/05/10', BillingCycle.MONTHLY)).toThrow(
        'Expected YYYY-MM-DD',
      );
    });
  });

  describe('SubscriptionProvisioningService Integration Specs', () => {
    let service: SubscriptionProvisioningService;
    let mockPrisma: any;
    let mockPasswordService: any;
    let mockEmailService: any;
    let mockNotificationsService: any;
    let mockEventEmitter: any;
    let mockSystemConfigService: any;

    const mockPlan = {
      id: 'PLAN-1',
      name: 'BASIC',
      code: 'PLAN_BASIC',
      status: 'Published',
    };

    const mockVersion = {
      id: 'VER-1',
      planId: 'PLAN-1',
      version: 1,
      status: 'Published',
      employeeLimit: 20,
      storageLimitGB: 10,
      monthlyPrice: 15000,
      yearlyPrice: 150000,
    };

    beforeEach(() => {
      mockPrisma = {
        saaSPlanNew: {
          findFirst: jest.fn().mockResolvedValue(mockPlan),
        },
        planVersion: {
          findFirst: jest.fn().mockResolvedValue(mockVersion),
        },
        $transaction: jest.fn().mockImplementation(async (callback) => {
          const tx = {
            company: {
              create: jest.fn().mockResolvedValue({ id: 'COMP-1', name: 'Test Co' }),
            },
            subscription: {
              create: jest.fn().mockImplementation((args) => ({
                id: 'SUB-1',
                ...args.data,
              })),
            },
            subscriptionEvent: {
              create: jest.fn().mockResolvedValue({ id: 'EVT-1' }),
            },
            companyPlanAssignment: {
              upsert: jest.fn().mockResolvedValue({ id: 'ASSIGN-1' }),
            },
            invoice: {
              create: jest.fn().mockResolvedValue({ id: 'INV-1' }),
            },
            department: {
              create: jest.fn().mockResolvedValue({ id: 'DEP-1' }),
            },
            designation: {
              create: jest.fn().mockResolvedValue({ id: 'DES-1' }),
            },
            role: {
              findFirst: jest.fn().mockResolvedValue(null),
              create: jest.fn().mockImplementation((args) => ({ id: `ROLE-${args.data.name}`, ...args.data })),
            },
            user: {
              findUnique: jest.fn().mockResolvedValue(null),
              create: jest.fn().mockResolvedValue({ id: 'USR-1' }),
            },
            attendanceSetting: {
              upsert: jest.fn().mockResolvedValue({ id: 'SET-1' }),
            },
            leaveType: {
              create: jest.fn().mockResolvedValue({ id: 'LT-1' }),
            },
            systemConfig: {
              upsert: jest.fn().mockResolvedValue({ id: 'SC-1' }),
            },
          };
          return callback(tx);
        }),
      };

      mockPasswordService = {
        hash: jest.fn().mockResolvedValue('hashed_password'),
      };
      mockEmailService = {
        sendEmail: jest.fn().mockResolvedValue(true),
      };
      mockNotificationsService = {
        notifyCompanyCreated: jest.fn().mockResolvedValue(true),
      };
      mockEventEmitter = {
        emit: jest.fn(),
      };
      mockSystemConfigService = {
        getConfiguredTrialDays: jest.fn().mockResolvedValue(14),
        isCompanyApprovalRequired: jest.fn().mockResolvedValue(false),
      };

      const mockRoleProvisioningService = {
        ensureDefaultRoles: jest.fn().mockResolvedValue({
          HRAdmin: { id: 'ROLE-HRAdmin' },
        }),
      };

      service = new SubscriptionProvisioningService(
        mockPrisma,
        mockPasswordService,
        mockEmailService,
        mockNotificationsService,
        mockEventEmitter,
        mockRoleProvisioningService as any,
        undefined,
        mockSystemConfigService,
        undefined,
      );
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('A. Trial custom start date calculates correct expiry (start=2026-09-01 -> expiry=2026-09-15)', async () => {
      const result = await service.createSubscription({
        company: 'Acme Corp',
        plan: 'BASIC',
        status: 'Trial',
        start: '2026-09-01',
        ownerName: 'Vikram',
        ownerEmail: 'vikram@acme.com',
      } as any);

      expect(result.status).toBe(SubscriptionStatus.TRIAL);
      expect(result.cycle).toBe(BillingCycle.TRIAL);
      expect(result.amount).toBe(0);
      expect(result.start).toBe('2026-09-01');
      expect(result.expiry).toBe('2026-09-15');
      expect(result.expiry > result.start).toBe(true);
    });

    it('B. Monthly Jan 31 start clamps to Feb 28 without overflowing to March', async () => {
      const result = await service.createSubscription({
        company: 'Acme Corp',
        plan: 'BASIC',
        status: 'Active',
        cycle: 'Monthly',
        start: '2026-01-31',
        ownerName: 'Vikram',
        ownerEmail: 'vikram@acme.com',
      } as any);

      expect(result.start).toBe('2026-01-31');
      expect(result.expiry).toBe('2026-02-28');
    });

    it('C. Monthly leap-year Jan 31 start clamps to Feb 29', async () => {
      const result = await service.createSubscription({
        company: 'Acme Corp',
        plan: 'BASIC',
        status: 'Active',
        cycle: 'Monthly',
        start: '2028-01-31',
        ownerName: 'Vikram',
        ownerEmail: 'vikram@acme.com',
      } as any);

      expect(result.start).toBe('2028-01-31');
      expect(result.expiry).toBe('2028-02-29');
    });

    it('D. Annual Feb 29 leap-year start clamps to Feb 28', async () => {
      const result = await service.createSubscription({
        company: 'Acme Corp',
        plan: 'BASIC',
        status: 'Active',
        cycle: 'Annual',
        start: '2024-02-29',
        ownerName: 'Vikram',
        ownerEmail: 'vikram@acme.com',
      } as any);

      expect(result.start).toBe('2024-02-29');
      expect(result.expiry).toBe('2025-02-28');
      expect(result.amount).toBe(150000);
    });

    it('E. Explicit administrator expiry override takes precedence', async () => {
      const result = await service.createSubscription({
        company: 'Acme Corp',
        plan: 'BASIC',
        status: 'Trial',
        start: '2026-09-01',
        expiry: '2026-10-31', // Explicit admin override
        ownerName: 'Vikram',
        ownerEmail: 'vikram@acme.com',
      } as any);

      expect(result.start).toBe('2026-09-01');
      expect(result.expiry).toBe('2026-10-31');
    });

    it('F. Default Trial start uses resolved business date and configured trial days', async () => {
      jest.spyOn(dateUtil, 'getBusinessDateString').mockReturnValue('2026-08-16');

      const result = await service.createSubscription({
        company: 'Acme Corp',
        plan: 'BASIC',
        status: 'Trial',
        ownerName: 'Vikram',
        ownerEmail: 'vikram@acme.com',
      } as any);

      expect(result.status).toBe(SubscriptionStatus.TRIAL);
      expect(result.cycle).toBe(BillingCycle.TRIAL);
      expect(result.start).toBe('2026-08-16');
      expect(result.expiry).toBe('2026-08-30');
    });

    it('G. Inconsistent request (status="Trial" + cycle="Monthly") forces Trial cycle & trialDays expiry', async () => {
      const result = await service.createSubscription({
        company: 'Acme Corp',
        plan: 'BASIC',
        status: 'Trial',
        cycle: 'Monthly', // Inconsistent
        start: '2026-09-01',
        ownerName: 'Vikram',
        ownerEmail: 'vikram@acme.com',
      } as any);

      expect(result.status).toBe(SubscriptionStatus.TRIAL);
      expect(result.cycle).toBe(BillingCycle.TRIAL);
      expect(result.amount).toBe(0);
      expect(result.expiry).toBe('2026-09-15');
    });

    it('H. Dynamic Trial Days from SystemConfigService (e.g. 21 days trial)', async () => {
      mockSystemConfigService.getConfiguredTrialDays.mockResolvedValue(21);

      const result = await service.createSubscription({
        company: 'Acme Corp',
        plan: 'BASIC',
        status: 'Trial',
        start: '2026-09-01',
        ownerName: 'Vikram',
        ownerEmail: 'vikram@acme.com',
      } as any);

      expect(result.start).toBe('2026-09-01');
      expect(result.expiry).toBe('2026-09-22');
      expect(mockSystemConfigService.getConfiguredTrialDays).toHaveBeenCalled();
    });

    it('I. Expiry date is strictly >= start date for all automatic cycles', async () => {
      const startDates = ['2026-01-01', '2026-02-28', '2026-08-16', '2026-12-31'];
      const cycles = [BillingCycle.TRIAL, BillingCycle.MONTHLY, BillingCycle.ANNUAL];

      for (const start of startDates) {
        for (const cycle of cycles) {
          const result = await service.createSubscription({
            company: `Co-${start}-${cycle}`,
            plan: 'BASIC',
            status: cycle === BillingCycle.TRIAL ? 'Trial' : 'Active',
            cycle,
            start,
            ownerName: 'Vikram',
            ownerEmail: 'vikram@acme.com',
          } as any);

          expect(result.expiry > result.start).toBe(true);
        }
      }
    });
  });
});

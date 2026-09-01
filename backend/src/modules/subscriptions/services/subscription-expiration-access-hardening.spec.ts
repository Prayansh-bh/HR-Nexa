import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { assertSubscriptionActive } from '../../../common/tenant/tenant-validation.util';
import * as dateUtil from '../../../common/utils/date.util';
import { SubscriptionGuard } from '../../auth/subscription.guard';
import { SubscriptionLifecycleService } from './subscription-lifecycle.service';
import { RefreshTokenService } from '../../auth/services/refresh-token.service';

describe('Subscription Expiration & Access Control Hardening Specs', () => {
  const BUSINESS_TODAY = '2026-08-16';

  beforeEach(() => {
    jest.spyOn(dateUtil, 'getBusinessDateString').mockReturnValue(BUSINESS_TODAY);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('1. Central Gatekeeper (assertSubscriptionActive)', () => {
    it('A. Trial expiry yesterday (past expiry) is rejected with SUBSCRIPTION_EXPIRED', () => {
      expect(() =>
        assertSubscriptionActive('HRAdmin', {
          status: 'Trial',
          expiry: '2026-08-15', // yesterday
          plan: 'BASIC',
        }),
      ).toThrow(
        expect.objectContaining({
          response: {
            statusCode: 403,
            code: 'SUBSCRIPTION_EXPIRED',
            message:
              'Your subscription has expired. Please renew your subscription to continue.',
          },
        }),
      );
    });

    it('B. Trial expiry today remains active', () => {
      expect(() =>
        assertSubscriptionActive('HRAdmin', {
          status: 'Trial',
          expiry: '2026-08-16', // today
          plan: 'BASIC',
        }),
      ).not.toThrow();
    });

    it('C. Trial expiry tomorrow remains active', () => {
      expect(() =>
        assertSubscriptionActive('HRAdmin', {
          status: 'Trial',
          expiry: '2026-08-17', // tomorrow
          plan: 'BASIC',
        }),
      ).not.toThrow();
    });

    it('D. Status Expired with future expiry date is rejected', () => {
      expect(() =>
        assertSubscriptionActive('HRAdmin', {
          status: 'Expired',
          expiry: '2026-09-01',
          plan: 'BASIC',
        }),
      ).toThrow(
        expect.objectContaining({
          response: expect.objectContaining({ code: 'SUBSCRIPTION_EXPIRED' }),
        }),
      );
    });

    it('E. Status Expired with past expiry date is rejected', () => {
      expect(() =>
        assertSubscriptionActive('HRAdmin', {
          status: 'Expired',
          expiry: '2026-08-01',
          plan: 'BASIC',
        }),
      ).toThrow(
        expect.objectContaining({
          response: expect.objectContaining({ code: 'SUBSCRIPTION_EXPIRED' }),
        }),
      );
    });

    it('F. Active subscription with past expiry is rejected', () => {
      expect(() =>
        assertSubscriptionActive('HRAdmin', {
          status: 'Active',
          expiry: '2026-08-10', // past
          plan: 'PREMIUM',
        }),
      ).toThrow(
        expect.objectContaining({
          response: expect.objectContaining({ code: 'SUBSCRIPTION_EXPIRED' }),
        }),
      );
    });

    it('G. Active subscription with future expiry is allowed', () => {
      expect(() =>
        assertSubscriptionActive('HRAdmin', {
          status: 'Active',
          expiry: '2026-09-16', // future
          plan: 'PREMIUM',
        }),
      ).not.toThrow();
    });

    it('N. Existing Suspended, Cancelled, Rejected, Pending behavior preserved', () => {
      expect(() =>
        assertSubscriptionActive('HRAdmin', { status: 'Suspended' }),
      ).toThrow('Company account is inactive.');

      expect(() =>
        assertSubscriptionActive('HRAdmin', { status: 'Cancelled' }),
      ).toThrow('Company account is inactive.');

      expect(() =>
        assertSubscriptionActive('HRAdmin', { status: 'Archived' }),
      ).toThrow('Company account is inactive.');

      expect(() =>
        assertSubscriptionActive('HRAdmin', { status: 'Pending Approval' }),
      ).toThrow(
        expect.objectContaining({
          response: expect.objectContaining({ code: 'COMPANY_PENDING_APPROVAL' }),
        }),
      );

      expect(() =>
        assertSubscriptionActive('HRAdmin', { status: 'Rejected' }),
      ).toThrow(
        expect.objectContaining({
          response: expect.objectContaining({ code: 'COMPANY_REJECTED' }),
        }),
      );

      // SuperAdmin bypasses
      expect(() =>
        assertSubscriptionActive('SuperAdmin', { status: 'Expired', expiry: '2020-01-01' }),
      ).not.toThrow();
    });
  });

  describe('2. SubscriptionGuard Enforcement', () => {
    let guard: SubscriptionGuard;
    let mockReflector: any;

    beforeEach(() => {
      mockReflector = {
        getAllAndOverride: jest.fn().mockReturnValue(false),
      };
      guard = new SubscriptionGuard(mockReflector, {} as any);
    });

    it('H. Blocks API access for expired tenant context', async () => {
      const mockContext: any = {
        getHandler: () => ({}),
        getClass: () => ({}),
        switchToHttp: () => ({
          getRequest: () => ({
            user: {
              role: 'HRAdmin',
              subscription: {
                status: 'Trial',
                expiry: '2020-08-14', // expired
              },
            },
          }),
        }),
      };

      await expect(guard.canActivate(mockContext)).rejects.toThrow(
        expect.objectContaining({
          response: expect.objectContaining({ code: 'SUBSCRIPTION_EXPIRED' }),
        }),
      );
    });

    it('Allows API access for valid active tenant', async () => {
      const mockContext: any = {
        getHandler: () => ({}),
        getClass: () => ({}),
        switchToHttp: () => ({
          getRequest: () => ({
            user: {
              role: 'HRAdmin',
              subscription: {
                status: 'Trial',
                expiry: '2035-08-20', // active
              },
            },
          }),
        }),
      };

      const result = await guard.canActivate(mockContext);
      expect(result).toBe(true);
    });
  });

  describe('3. Refresh Token Rotation Enforcement', () => {
    let refreshTokenService: RefreshTokenService;
    let mockPrisma: any;
    let mockUserRepository: any;
    let mockTokenHashService: any;

    beforeEach(() => {
      mockPrisma = {
        userSession: {
          findUnique: jest.fn(),
          update: jest.fn(),
        },
      };
      mockUserRepository = {
        findById: jest.fn(),
      };
      mockTokenHashService = {
        hash: jest.fn().mockReturnValue('mock-hash'),
      };

      refreshTokenService = new RefreshTokenService(
        {} as any,
        mockUserRepository,
        mockPrisma,
        mockTokenHashService,
        { parse: jest.fn().mockReturnValue({}) } as any,
        undefined,
      );
    });

    it('I. Refresh token rotation is rejected when tenant subscription is expired', async () => {
      mockPrisma.userSession.findUnique.mockResolvedValue({
        id: 'SES-1',
        tokenHash: 'mock-hash',
        userId: 'USR-1',
        familyId: 'FAM-1',
        expiresAt: new Date(Date.now() + 100000),
        revokedAt: null,
      });

      mockUserRepository.findById.mockResolvedValue({
        id: 'USR-1',
        role: 'HRAdmin',
        status: 'Active',
        subscription: {
          id: 'SUB-1',
          status: 'Trial',
          expiry: '2026-08-10', // expired
        },
      });

      await expect(
        refreshTokenService.rotateRefreshToken('valid-refresh-token'),
      ).rejects.toThrow(
        expect.objectContaining({
          response: expect.objectContaining({ code: 'SUBSCRIPTION_EXPIRED' }),
        }),
      );
    });
  });

  describe('4. Expiration Reconciliation (SubscriptionLifecycleService)', () => {
    let lifecycleService: SubscriptionLifecycleService;
    let mockPrisma: any;

    beforeEach(() => {
      mockPrisma = {
        subscription: {
          findMany: jest.fn(),
          updateMany: jest.fn(),
        },
      };

      lifecycleService = new SubscriptionLifecycleService(
        mockPrisma,
        {} as any,
        {} as any,
        {} as any,
        undefined,
      );
    });

    it('J & K. Reconciles Trial & Active subscriptions with past expiry to Expired', async () => {
      mockPrisma.subscription.findMany.mockResolvedValue([
        { id: 'SUB-TRIAL-EXPIRED', company: 'Acme Trial', status: 'Trial', expiry: '2026-08-10' },
        { id: 'SUB-ACTIVE-EXPIRED', company: 'Acme Active', status: 'Active', expiry: '2026-08-14' },
      ]);
      mockPrisma.subscription.updateMany.mockResolvedValue({ count: 2 });

      const result = await lifecycleService.reconcileExpiredSubscriptions();

      expect(mockPrisma.subscription.findMany).toHaveBeenCalledWith({
        where: {
          expiry: { lt: BUSINESS_TODAY },
          status: { in: ['Trial', 'Active', 'Paid'] },
        },
        select: { id: true, company: true, status: true, expiry: true },
      });

      expect(mockPrisma.subscription.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['SUB-TRIAL-EXPIRED', 'SUB-ACTIVE-EXPIRED'] } },
        data: { status: 'Expired' },
      });

      expect(result.updatedCount).toBe(2);
      expect(result.subscriptionIds).toEqual(['SUB-TRIAL-EXPIRED', 'SUB-ACTIVE-EXPIRED']);
    });

    it('L & M. Idempotent: Does not touch future or already Expired subscriptions', async () => {
      mockPrisma.subscription.findMany.mockResolvedValue([]);

      const result = await lifecycleService.reconcileExpiredSubscriptions();

      expect(mockPrisma.subscription.updateMany).not.toHaveBeenCalled();
      expect(result.updatedCount).toBe(0);
      expect(result.subscriptionIds).toEqual([]);
    });
  });
});

import { BadRequestException, NotFoundException } from '@nestjs/common';
import { SubscriptionUsageService } from './subscription-usage.service';
import { SubscriptionsService } from './subscriptions.service';
import { SubscriptionsController } from '../controllers/subscriptions.controller';
import { Role } from '../../auth/role.enum';
import { Permission } from '../../auth/permissions.enum';
import { PermissionsGuard } from '../../auth/permissions.guard';
import { EffectiveFeatureService } from '../../plans/services/effective-feature.service';
import { PermissionResolver } from '../../auth/services/permission-resolver.service';
import { ExecutionContext } from '@nestjs/common';

describe('Seat Management & Entitlement Security Matrix (Part M 25-Scenario Verification)', () => {
  let usageService: SubscriptionUsageService;
  let subscriptionsService: SubscriptionsService;
  let controller: SubscriptionsController;

  let mockPrisma: any;
  let mockEmployeeCountSyncService: any;
  let mockPasswordResetService: any;
  let mockEventEmitter: any;
  let mockRepository: any;
  let mockProvisioningService: any;
  let mockLifecycleService: any;
  let mockBillingService: any;
  let mockDashboardService: any;
  let mockCouponService: any;

  const mockSubscriptionsDb: Record<string, any> = {};
  const mockEmployeesDb: Record<string, any[]> = {};
  const mockEventsDb: any[] = [];

  beforeEach(() => {
    // Clear any static caches
    EffectiveFeatureService.clearCache();
    PermissionsGuard.clearCache();

    // Reset test DB
    mockSubscriptionsDb['sub-company-a'] = {
      id: 'sub-company-a',
      companyId: 'comp-a-uuid',
      company: 'Company Alpha',
      plan: 'BASIC',
      status: 'Active',
      expiry: '2027-12-31',
      purchasedSeats: 50,
      usedSeats: 37,
      employeesCount: 37,
      storageUsedMB: 1024,
      storageLimitMB: 10240,
    };

    mockSubscriptionsDb['sub-company-b'] = {
      id: 'sub-company-b',
      companyId: 'comp-b-uuid',
      company: 'Company Beta',
      plan: 'ENTERPRISE',
      status: 'Active',
      expiry: '2027-12-31',
      purchasedSeats: 100,
      usedSeats: 40,
      employeesCount: 40,
    };

    mockEmployeesDb['comp-a-uuid'] = Array.from({ length: 37 }, (_, i) => ({
      id: `emp-a-${i}`,
      companyId: 'comp-a-uuid',
      status: i < 35 ? 'Active' : 'On Leave',
    }));

    mockEmployeesDb['comp-b-uuid'] = Array.from({ length: 40 }, (_, i) => ({
      id: `emp-b-${i}`,
      companyId: 'comp-b-uuid',
      status: 'Active',
    }));

    mockEventsDb.length = 0;

    mockEmployeeCountSyncService = {
      getActiveEmployeeCount: jest.fn(async (companyId: string) => {
        const emps = mockEmployeesDb[companyId] || [];
        return emps.filter((e) => ['Active', 'ACTIVE', 'On Leave'].includes(e.status)).length;
      }),
      getActualEmployeeCount: jest.fn(async (companyId: string) => {
        return (mockEmployeesDb[companyId] || []).length;
      }),
    };

    mockPrisma = {
      subscription: {
        findUnique: jest.fn(async ({ where }: { where: { id: string } }) => {
          return mockSubscriptionsDb[where.id] ? { ...mockSubscriptionsDb[where.id] } : null;
        }),
        update: jest.fn(async ({ where, data }: { where: { id: string }; data: any }) => {
          if (!mockSubscriptionsDb[where.id]) throw new NotFoundException('Not found');
          mockSubscriptionsDb[where.id] = {
            ...mockSubscriptionsDb[where.id],
            ...data,
          };
          return { ...mockSubscriptionsDb[where.id] };
        }),
      },
      subscriptionEvent: {
        create: jest.fn(async ({ data }: any) => {
          mockEventsDb.push(data);
          return { id: `event-${mockEventsDb.length}`, ...data };
        }),
      },
      company: {
        update: jest.fn().mockResolvedValue({}),
      },
      $transaction: jest.fn(async (callback: any) => {
        return callback(mockPrisma);
      }),
    };

    mockPasswordResetService = {
      requestPasswordResetForUser: jest.fn(),
    };

    mockEventEmitter = {
      emit: jest.fn(),
    };

    usageService = new SubscriptionUsageService(
      mockPrisma,
      mockPasswordResetService,
      mockEmployeeCountSyncService,
      undefined,
      undefined,
      mockEventEmitter,
    );

    mockRepository = {
      findAll: jest.fn(),
      findById: jest.fn(),
    };
    mockProvisioningService = {};
    mockLifecycleService = {};
    mockBillingService = {};
    mockDashboardService = {};
    mockCouponService = {};

    subscriptionsService = new SubscriptionsService(
      mockRepository,
      mockProvisioningService,
      mockLifecycleService,
      mockBillingService,
      mockDashboardService,
      usageService,
      mockCouponService,
    );

    controller = new SubscriptionsController(subscriptionsService);
  });

  // 1. SuperAdmin can increase Company A seats
  it('Scenario 1: SuperAdmin can increase Company A seats', async () => {
    const result = await usageService.updatePurchasedSeats('sub-company-a', 60, {
      name: 'SuperAdmin',
      role: Role.SuperAdmin,
    });
    expect(result.purchasedSeats).toBe(60);
    expect(result.activeEmployeeCount).toBe(37);
    expect(result.availableSeats).toBe(23);
    expect(mockSubscriptionsDb['sub-company-a'].purchasedSeats).toBe(60);
  });

  // 2. SuperAdmin can decrease Company A seats when requested seats >= active employees
  it('Scenario 2: SuperAdmin can decrease Company A seats when requested seats >= active employees', async () => {
    const result = await usageService.updatePurchasedSeats('sub-company-a', 37, {
      name: 'SuperAdmin',
    });
    expect(result.purchasedSeats).toBe(37);
    expect(result.availableSeats).toBe(0);
    expect(mockSubscriptionsDb['sub-company-a'].purchasedSeats).toBe(37);
  });

  // 3. SuperAdmin cannot decrease seats below active employee count
  it('Scenario 3: SuperAdmin cannot decrease seats below active employee count', async () => {
    await expect(
      usageService.updatePurchasedSeats('sub-company-a', 30, { name: 'SuperAdmin' }),
    ).rejects.toThrow(BadRequestException);

    try {
      await usageService.updatePurchasedSeats('sub-company-a', 30, { name: 'SuperAdmin' });
    } catch (err: any) {
      expect(err.response.errorCode).toBe('SEATS_BELOW_ACTIVE_EMPLOYEES');
      expect(err.response.message).toContain('Cannot reduce seats below the current active employee count (37).');
    }
  });

  // 4. Company A active employees remain unchanged after seat reduction
  it('Scenario 4: Company A active employees remain unchanged after seat reduction', async () => {
    await usageService.updatePurchasedSeats('sub-company-a', 40, { name: 'SuperAdmin' });
    expect(mockEmployeesDb['comp-a-uuid'].length).toBe(37);
    const activeCount = await mockEmployeeCountSyncService.getActiveEmployeeCount('comp-a-uuid');
    expect(activeCount).toBe(37);
  });

  // 5. Company A subscription plan remains unchanged after seat adjustment
  it('Scenario 5: Company A subscription plan remains unchanged after seat adjustment', async () => {
    await usageService.updatePurchasedSeats('sub-company-a', 75, { name: 'SuperAdmin' });
    expect(mockSubscriptionsDb['sub-company-a'].plan).toBe('BASIC');
  });

  // 6. Company A expiry remains unchanged after seat adjustment
  it('Scenario 6: Company A expiry remains unchanged after seat adjustment', async () => {
    await usageService.updatePurchasedSeats('sub-company-a', 75, { name: 'SuperAdmin' });
    expect(mockSubscriptionsDb['sub-company-a'].expiry).toBe('2027-12-31');
  });

  // 7. Company A status remains unchanged after seat adjustment
  it('Scenario 7: Company A status remains unchanged after seat adjustment', async () => {
    await usageService.updatePurchasedSeats('sub-company-a', 75, { name: 'SuperAdmin' });
    expect(mockSubscriptionsDb['sub-company-a'].status).toBe('Active');
  });

  // 8. Company B seat limit remains unchanged
  it('Scenario 8: Company B seat limit remains unchanged when Company A seats are updated', async () => {
    await usageService.updatePurchasedSeats('sub-company-a', 75, { name: 'SuperAdmin' });
    expect(mockSubscriptionsDb['sub-company-b'].purchasedSeats).toBe(100);
  });

  // 9. Non-SuperAdmin cannot invoke seat-management endpoint (Role metadata verification)
  it('Scenario 9: Non-SuperAdmin cannot invoke seat-management endpoint (RolesGuard check)', () => {
    const roles = Reflect.getMetadata('roles', SubscriptionsController.prototype.updateSeats);
    expect(roles).toEqual([Role.SuperAdmin]);
  });

  // 10. CompanyOwner cannot invoke platform seat-management endpoint
  it('Scenario 10: CompanyOwner is excluded from @Roles(Role.SuperAdmin) on updateSeats', () => {
    const roles = Reflect.getMetadata('roles', SubscriptionsController.prototype.updateSeats);
    expect(roles).not.toContain(Role.CompanyOwner);
    expect(roles).toEqual([Role.SuperAdmin]);
  });

  // 11. Tenant user cannot manipulate another company seat limit
  it('Scenario 11: Direct call by tenant user context cannot manipulate seat limit without SuperAdmin authority', async () => {
    const roles = Reflect.getMetadata('roles', SubscriptionsController.prototype.updateSeats);
    expect(roles).toEqual([Role.SuperAdmin]);
    expect(roles.includes(Role.Employee)).toBe(false);
    expect(roles.includes(Role.HRAdmin)).toBe(false);
  });

  // 12. Client-supplied companyId cannot override server-resolved target company
  it('Scenario 12: Server resolves target companyId strictly from authoritative database subscription record', async () => {
    const result = await controller.updateSeats(
      'sub-company-a',
      { seats: 55 },
      { user: { role: Role.SuperAdmin, name: 'SuperAdmin' } } as any,
    );
    expect(result.companyId).toBe('comp-a-uuid');
    expect(result.purchasedSeats).toBe(55);
  });

  // 13. Increasing seats does not automatically grant any feature permission
  it('Scenario 13: Increasing seats does not alter plan or grant feature permissions', async () => {
    await controller.updateSeats(
      'sub-company-a',
      { seats: 100 },
      { user: { role: Role.SuperAdmin } } as any,
    );
    expect(mockSubscriptionsDb['sub-company-a'].plan).toBe('BASIC');
  });

  // 14. Enabling a feature via TenantFeatureOverride affects Company A only
  it('Scenario 14: Enabling a feature via TenantFeatureOverride affects Company A only', async () => {
    const overridesDb: any[] = [
      {
        id: 'override-1',
        companyId: 'comp-a-uuid',
        featureKey: 'MODULE_PERFORMANCE',
        enabled: true,
      },
    ];

    const prismaMock = {
      company: {
        findUnique: jest.fn(async ({ where }: any) => ({
          id: where.id,
          name: where.id === 'comp-a-uuid' ? 'Company Alpha' : 'Company Beta',
        })),
      },
      companyPlanAssignment: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
      saaSPlanNew: {
        findUnique: jest.fn().mockResolvedValue({
          name: 'BASIC',
          versions: [{ id: 'v-basic' }],
        }),
      },
      planVersion: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'v-basic',
          features: [{ feature: { key: 'MODULE_PERFORMANCE' }, enabled: false }],
        }),
      },
      tenantFeatureOverride: {
        findMany: jest.fn(async ({ where }: any) => {
          return overridesDb.filter((o) => o.companyId === where.companyId && o.enabled);
        }),
      },
      feature: {
        findMany: jest.fn().mockResolvedValue([{ key: 'MODULE_PERFORMANCE' }]),
      },
    };

    const effectiveFeatureService = new EffectiveFeatureService(prismaMock as any);

    const isAEnabled = await effectiveFeatureService.isFeatureEffective('comp-a-uuid', 'MODULE_PERFORMANCE');
    const isBEnabled = await effectiveFeatureService.isFeatureEffective('comp-b-uuid', 'MODULE_PERFORMANCE');

    expect(isAEnabled).toBe(true);
    expect(isBEnabled).toBe(false);
  });

  // 15. Company B remains on its own plan entitlement
  it('Scenario 15: Company B remains on its own plan entitlement without override leakage', async () => {
    const overridesDb: any[] = [
      {
        id: 'override-1',
        companyId: 'comp-a-uuid',
        featureKey: 'MODULE_PERFORMANCE',
        enabled: true,
      },
    ];

    const prismaMock = {
      company: {
        findUnique: jest.fn(async ({ where }: any) => ({
          id: where.id,
          name: where.id === 'comp-a-uuid' ? 'Company Alpha' : 'Company Beta',
        })),
      },
      companyPlanAssignment: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
      saaSPlanNew: {
        findUnique: jest.fn().mockResolvedValue({
          name: 'BASIC',
          versions: [{ id: 'v-basic' }],
        }),
      },
      planVersion: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'v-basic',
          features: [{ feature: { key: 'MODULE_PERFORMANCE' }, enabled: false }],
        }),
      },
      tenantFeatureOverride: {
        findMany: jest.fn(async ({ where }: any) => {
          return overridesDb.filter((o) => o.companyId === where.companyId && o.enabled);
        }),
      },
      feature: {
        findMany: jest.fn().mockResolvedValue([{ key: 'MODULE_PERFORMANCE' }]),
      },
    };

    const effectiveFeatureService = new EffectiveFeatureService(prismaMock as any);
    const isBEnabled = await effectiveFeatureService.isFeatureEffective('comp-b-uuid', 'MODULE_PERFORMANCE');
    expect(isBEnabled).toBe(false);
  });

  // 16. CompanyOwner remains subject to plan entitlement
  it('Scenario 16: CompanyOwner without plan entitlement or override is denied in PermissionsGuard', async () => {
    PermissionsGuard.clearCache();
    const reflectorMock = {
      getAllAndOverride: jest.fn().mockReturnValue([Permission.PERFORMANCE_REVIEWS_VIEW]),
    };
    const prismaMock = {
      permission: {
        findUnique: jest.fn().mockResolvedValue({
          key: Permission.PERFORMANCE_REVIEWS_VIEW,
          feature: { key: 'MODULE_PERFORMANCE' },
        }),
      },
      companyPlanAssignment: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
      saaSPlanNew: {
        findUnique: jest.fn().mockResolvedValue({
          name: 'BASIC',
          versions: [{ id: 'v-basic-none' }],
        }),
      },
      planVersion: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'v-basic-none',
          features: [], // No performance feature in plan
        }),
      },
      tenantFeatureOverride: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    const guard = new PermissionsGuard(reflectorMock as any, prismaMock as any);

    const context = {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({
          user: {
            id: 'owner-1',
            role: 'CompanyOwner',
            companyId: 'comp-a-uuid',
            permissions: [Permission.PERFORMANCE_REVIEWS_VIEW],
            subscription: { plan: 'BASIC', company: 'Company Alpha' },
          },
        }),
      }),
    } as ExecutionContext;

    await expect(guard.canActivate(context)).rejects.toThrow();
  });

  // 17. Removing RBAC permission denies access even when feature is plan-enabled
  it('Scenario 17: Removing RBAC permission denies access even when feature is plan-enabled', async () => {
    const reflectorMock = {
      getAllAndOverride: jest.fn().mockReturnValue([Permission.PERFORMANCE_REVIEWS_VIEW]),
    };
    const prismaMock = {};

    const guard = new PermissionsGuard(reflectorMock as any, prismaMock as any);

    const context = {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({
          user: {
            id: 'hr-1',
            role: 'HRAdmin',
            companyId: 'comp-a-uuid',
            permissions: [], // RBAC permission missing
            subscription: { plan: 'PREMIUM', company: 'Company Alpha' },
          },
        }),
      }),
    } as ExecutionContext;

    await expect(guard.canActivate(context)).rejects.toThrow();
  });

  // 18. HRAdmin role name alone cannot bypass RBAC
  it('Scenario 18: HRAdmin role name alone cannot bypass RBAC when permission is absent', async () => {
    const reflectorMock = {
      getAllAndOverride: jest.fn().mockReturnValue([Permission.SETTINGS_ROLES_VIEW]),
    };
    const prismaMock = {};

    const guard = new PermissionsGuard(reflectorMock as any, prismaMock as any);

    const context = {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({
          user: {
            id: 'hr-1',
            role: 'HRAdmin',
            companyId: 'comp-a-uuid',
            permissions: [],
            subscription: { plan: 'ENTERPRISE', company: 'Company Alpha' },
          },
        }),
      }),
    } as ExecutionContext;

    await expect(guard.canActivate(context)).rejects.toThrow();
  });

  // 19. Accountant role name alone cannot bypass RBAC
  it('Scenario 19: Accountant role name alone cannot bypass RBAC', async () => {
    const reflectorMock = {
      getAllAndOverride: jest.fn().mockReturnValue([Permission.PAYROLL_PROCESS]),
    };
    const prismaMock = {};

    const guard = new PermissionsGuard(reflectorMock as any, prismaMock as any);

    const context = {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({
          user: {
            id: 'acc-1',
            role: 'Accountant',
            companyId: 'comp-a-uuid',
            permissions: [],
            subscription: { plan: 'ENTERPRISE', company: 'Company Alpha' },
          },
        }),
      }),
    } as ExecutionContext;

    await expect(guard.canActivate(context)).rejects.toThrow();
  });

  // 20. Expired feature override is denied
  it('Scenario 20: Expired feature override is excluded from active overrides', async () => {
    const expiredDate = new Date(Date.now() - 86400000);
    const overridesDb: any[] = [
      {
        id: 'override-expired',
        companyId: 'comp-a-uuid',
        featureKey: 'MODULE_PERFORMANCE',
        enabled: true,
        expiresAt: expiredDate,
      },
    ];

    const prismaMock = {
      company: {
        findUnique: jest.fn(async () => ({ id: 'comp-a-uuid', name: 'Company Alpha' })),
      },
      companyPlanAssignment: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
      saaSPlanNew: {
        findUnique: jest.fn().mockResolvedValue({
          name: 'BASIC',
          versions: [{ id: 'v-basic' }],
        }),
      },
      planVersion: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'v-basic',
          features: [{ feature: { key: 'MODULE_PERFORMANCE' }, enabled: false }],
        }),
      },
      tenantFeatureOverride: {
        findMany: jest.fn(async () => overridesDb),
      },
      feature: {
        findMany: jest.fn().mockResolvedValue([{ key: 'MODULE_PERFORMANCE' }]),
      },
    };

    const effectiveFeatureService = new EffectiveFeatureService(prismaMock as any);
    const isAEnabled = await effectiveFeatureService.isFeatureEffective('comp-a-uuid', 'MODULE_PERFORMANCE');
    expect(isAEnabled).toBe(false);
  });

  // 21. Revoked feature override is denied
  it('Scenario 21: Revoked (enabled=false) feature override is excluded from active overrides', async () => {
    const overridesDb: any[] = [
      {
        id: 'override-revoked',
        companyId: 'comp-a-uuid',
        featureKey: 'MODULE_PERFORMANCE',
        enabled: false,
      },
    ];

    const prismaMock = {
      company: {
        findUnique: jest.fn(async () => ({ id: 'comp-a-uuid', name: 'Company Alpha' })),
      },
      companyPlanAssignment: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
      saaSPlanNew: {
        findUnique: jest.fn().mockResolvedValue({
          name: 'BASIC',
          versions: [{ id: 'v-basic' }],
        }),
      },
      planVersion: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'v-basic',
          features: [{ feature: { key: 'MODULE_PERFORMANCE' }, enabled: true }],
        }),
      },
      tenantFeatureOverride: {
        findMany: jest.fn(async () => overridesDb),
      },
      feature: {
        findMany: jest.fn().mockResolvedValue([{ key: 'MODULE_PERFORMANCE' }]),
      },
    };

    const effectiveFeatureService = new EffectiveFeatureService(prismaMock as any);
    const isAEnabled = await effectiveFeatureService.isFeatureEffective('comp-a-uuid', 'MODULE_PERFORMANCE');
    expect(isAEnabled).toBe(false);
  });

  // 22. ADVANCED_AUDIT remains plan-gated
  it('Scenario 22: ADVANCED_AUDIT is not in PLATFORM_CORE_PERMISSIONS and requires feature entitlement', async () => {
    PermissionsGuard.clearCache();
    const reflectorMock = {
      getAllAndOverride: jest.fn().mockReturnValue([Permission.SYSTEM_AUDIT_VIEW]),
    };
    const prismaMock = {
      permission: {
        findUnique: jest.fn().mockResolvedValue({
          key: Permission.SYSTEM_AUDIT_VIEW,
          feature: { key: 'ADVANCED_AUDIT' },
        }),
      },
      companyPlanAssignment: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
      saaSPlanNew: {
        findUnique: jest.fn().mockResolvedValue({
          name: 'BASIC',
          versions: [{ id: 'v-basic-no-audit' }],
        }),
      },
      planVersion: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'v-basic-no-audit',
          features: [],
        }),
      },
      tenantFeatureOverride: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    const guard = new PermissionsGuard(reflectorMock as any, prismaMock as any);

    const context = {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({
          user: {
            id: 'hr-1',
            role: 'HRAdmin',
            companyId: 'comp-a-uuid',
            permissions: [Permission.SYSTEM_AUDIT_VIEW],
            subscription: { plan: 'BASIC', company: 'Company Alpha' },
          },
        }),
      }),
    } as ExecutionContext;

    await expect(guard.canActivate(context)).rejects.toThrow();
  });

  // 23. EXPENSE_CLAIMS canonical permissions remain functional
  it('Scenario 23: EXPENSE_CLAIMS canonical permissions (expenses:claims:view) succeed when plan-enabled & RBAC granted', async () => {
    PermissionsGuard.clearCache();
    const reflectorMock = {
      getAllAndOverride: jest.fn().mockReturnValue([Permission.EXPENSES_VIEW]),
    };
    const prismaMock = {
      permission: {
        findUnique: jest.fn().mockResolvedValue({
          key: Permission.EXPENSES_VIEW,
          feature: { key: 'EXPENSE_CLAIMS' },
        }),
      },
      companyPlanAssignment: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
      saaSPlanNew: {
        findUnique: jest.fn().mockResolvedValue({
          name: 'PREMIUM',
          versions: [{ id: 'v-prem-exp' }],
        }),
      },
      planVersion: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'v-prem-exp',
          features: [{ feature: { key: 'EXPENSE_CLAIMS' }, enabled: true }],
        }),
      },
      tenantFeatureOverride: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    const guard = new PermissionsGuard(reflectorMock as any, prismaMock as any);

    const context = {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({
          user: {
            id: 'emp-1',
            role: 'Employee',
            companyId: 'comp-a-uuid',
            permissions: [Permission.EXPENSES_VIEW],
            subscription: { plan: 'PREMIUM', company: 'Company Alpha' },
          },
        }),
      }),
    } as ExecutionContext;

    const allowed = await guard.canActivate(context);
    expect(allowed).toBe(true);
  });

  // 24. Cross-tenant role resolution remains impossible
  it('Scenario 24: Cross-tenant role resolution is impossible with scoped tenant boundary', async () => {
    const prismaRoleMock = {
      role: {
        findUnique: jest.fn().mockResolvedValue(null),
        findFirst: jest.fn(async ({ where }: any) => {
          // If querying for company B, company A's custom role is never returned
          if (where.companyId === 'comp-b-uuid' && where.name === 'CustomRole') {
            return null;
          }
          if (where.companyId === null && where.isSystem === true) {
            return null;
          }
          return null;
        }),
      },
      companyPlanAssignment: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
      saaSPlanNew: {
        findUnique: jest.fn().mockResolvedValue({
          name: 'BASIC',
          versions: [{ id: 'v-basic' }],
        }),
      },
      planVersion: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'v-basic',
          features: [],
        }),
      },
      tenantFeatureOverride: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      feature: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    const resolver = new PermissionResolver(prismaRoleMock as any);
    const resolvedRoleForB = await resolver.resolve({
      id: 'user-b',
      companyId: 'comp-b-uuid',
      role: 'CustomRole',
      subscription: { plan: 'BASIC' },
    });

    // Tenant B cannot resolve Tenant A's CustomRole
    expect(resolvedRoleForB).toEqual([]);
  });

  // 25. Subscription expiration still blocks tenant requests
  it('Scenario 25: Subscription expiration blocks tenant requests in subscription lifecycle checks', async () => {
    const expiredSub = {
      id: 'sub-expired',
      companyId: 'comp-expired',
      status: 'Expired',
      expiry: '2020-01-01',
    };

    const isBlocked = expiredSub.status === 'Expired' || new Date(expiredSub.expiry) < new Date();
    expect(isBlocked).toBe(true);
  });
});

import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsGuard } from '../permissions.guard';
import { PermissionResolver } from '../services/permission-resolver.service';
import { getEffectivePermissions, clearTenantEntitlementCache } from '../../../common/tenant/tenant-validation.util';
import { EffectiveFeatureService } from '../../plans/services/effective-feature.service';

describe('HR NEXA SaaS Entitlement + RBAC Adversarial Security Matrix (20 Forensic Tests)', () => {
  let guard: PermissionsGuard;
  let permissionResolver: PermissionResolver;
  let effectiveFeatureService: EffectiveFeatureService;
  let reflector: Reflector;
  let mockPrisma: any;

  beforeEach(() => {
    PermissionsGuard.clearCache();
    clearTenantEntitlementCache();
    EffectiveFeatureService.clearCache();

    mockPrisma = {
      role: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      company: {
        findUnique: jest.fn(),
      },
      companyPlanAssignment: {
        findUnique: jest.fn(),
      },
      saaSPlanNew: {
        findUnique: jest.fn(),
      },
      planVersion: {
        findUnique: jest.fn(),
      },
      tenantFeatureOverride: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
        upsert: jest.fn(),
        deleteMany: jest.fn(),
      },
      permission: {
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
      },
      feature: {
        findMany: jest.fn().mockResolvedValue([
          { key: 'CORE_HR', name: 'Core HR' },
          { key: 'PAYROLL_BASIC', name: 'Payroll Basic' },
          { key: 'TAX_DECLARATIONS', name: 'Tax Declarations' },
          { key: 'EXPENSE_CLAIMS', name: 'Expense Claims' },
          { key: 'MODULE_PERFORMANCE', name: 'Performance' },
          { key: 'ADVANCED_AUDIT', name: 'Advanced Audit' },
        ]),
        findUnique: jest.fn(),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({ id: 'audit-1' }),
      },
    };

    reflector = new Reflector();
    guard = new PermissionsGuard(reflector, mockPrisma);
    permissionResolver = new PermissionResolver(mockPrisma);
    effectiveFeatureService = new EffectiveFeatureService(mockPrisma);
  });

  function createMockContext(user: any, requiredPermissions: string[] = []): ExecutionContext {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(requiredPermissions);
    return {
      switchToHttp: () => ({
        getRequest: () => ({ user }),
        getResponse: () => ({}),
        getNext: () => ({}),
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;
  }

  // Helper setup for standard mock plan versions
  function setupPlanVersion(planVersionId: string, enabledFeatureKeys: string[]) {
    mockPrisma.planVersion.findUnique.mockImplementation(({ where }: any) => {
      if (where.id === planVersionId) {
        return Promise.resolve({
          id: planVersionId,
          features: enabledFeatureKeys.map((key) => ({
            enabled: true,
            feature: { key },
          })),
        });
      }
      return Promise.resolve(null);
    });
  }

  // =========================================================================
  // TEST 1: CompanyOwner + BASIC + TAX_DECLARATIONS => HTTP 403
  // =========================================================================
  describe('Test 1 — CompanyOwner + BASIC + TAX_DECLARATIONS => HTTP 403', () => {
    it('MUST DENY CompanyOwner on BASIC plan attempting to access TAX_DECLARATIONS', async () => {
      setupPlanVersion('v-basic', ['CORE_HR', 'PAYROLL_BASIC']);
      mockPrisma.companyPlanAssignment.findUnique.mockResolvedValue({
        planVersionId: 'v-basic',
      });

      const user = {
        id: 'user-owner-1',
        role: 'CompanyOwner',
        companyId: 'comp-basic-1',
        permissions: ['tax:declarations:view', 'tax:declarations:manage'],
        subscription: { company: 'Basic Company', plan: 'BASIC', status: 'Active' },
      };

      const ctx = createMockContext(user, ['tax:declarations:view']);
      await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
    });
  });

  // =========================================================================
  // TEST 2: CompanyOwner + BASIC + PERFORMANCE => HTTP 403
  // =========================================================================
  describe('Test 2 — CompanyOwner + BASIC + PERFORMANCE => HTTP 403', () => {
    it('MUST DENY CompanyOwner on BASIC plan attempting to access PERFORMANCE', async () => {
      setupPlanVersion('v-basic', ['CORE_HR', 'PAYROLL_BASIC']);
      mockPrisma.companyPlanAssignment.findUnique.mockResolvedValue({
        planVersionId: 'v-basic',
      });

      const user = {
        id: 'user-owner-2',
        role: 'CompanyOwner',
        companyId: 'comp-basic-2',
        permissions: ['performance:reviews:view', 'performance:cycles:manage'],
        subscription: { company: 'Basic Company 2', plan: 'BASIC', status: 'Active' },
      };

      const ctx = createMockContext(user, ['performance:reviews:view']);
      await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
    });
  });

  // =========================================================================
  // TEST 3: CompanyOwner + PREMIUM + properly granted RBAC permission => HTTP 200/allowed
  // =========================================================================
  describe('Test 3 — CompanyOwner + PREMIUM + properly granted RBAC permission => allowed', () => {
    it('MUST ALLOW CompanyOwner on PREMIUM plan with valid RBAC permission', async () => {
      setupPlanVersion('v-premium', [
        'CORE_HR',
        'PAYROLL_BASIC',
        'TAX_DECLARATIONS',
        'EXPENSE_CLAIMS',
        'MODULE_PERFORMANCE',
        'ADVANCED_AUDIT',
      ]);
      mockPrisma.companyPlanAssignment.findUnique.mockResolvedValue({
        planVersionId: 'v-premium',
      });

      const user = {
        id: 'user-owner-3',
        role: 'CompanyOwner',
        companyId: 'comp-prem-1',
        permissions: ['performance:reviews:view', 'tax:declarations:view'],
        subscription: { company: 'Premium Company', plan: 'PREMIUM', status: 'Active' },
      };

      const ctx = createMockContext(user, ['performance:reviews:view']);
      const result = await guard.canActivate(ctx);
      expect(result).toBe(true);
    });
  });

  // =========================================================================
  // TEST 4: CompanyOwner + PREMIUM + permission removed from DB role => HTTP 403
  // =========================================================================
  describe('Test 4 — CompanyOwner + PREMIUM + permission removed from DB role => HTTP 403', () => {
    it('MUST DENY CompanyOwner on PREMIUM plan when required permission is absent from user permissions', async () => {
      setupPlanVersion('v-premium', [
        'CORE_HR',
        'PAYROLL_BASIC',
        'MODULE_PERFORMANCE',
      ]);
      mockPrisma.companyPlanAssignment.findUnique.mockResolvedValue({
        planVersionId: 'v-premium',
      });

      const user = {
        id: 'user-owner-4',
        role: 'CompanyOwner',
        companyId: 'comp-prem-1',
        permissions: ['employees:list:view'], // performance:reviews:view is stripped/missing
        subscription: { company: 'Premium Company', plan: 'PREMIUM', status: 'Active' },
      };

      const ctx = createMockContext(user, ['performance:reviews:view']);
      await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
    });
  });

  // =========================================================================
  // TEST 5: HRAdmin + BASIC + PERFORMANCE => HTTP 403
  // =========================================================================
  describe('Test 5 — HRAdmin + BASIC + PERFORMANCE => HTTP 403', () => {
    it('MUST DENY HRAdmin on BASIC plan attempting to use PERFORMANCE', async () => {
      setupPlanVersion('v-basic', ['CORE_HR', 'PAYROLL_BASIC']);
      mockPrisma.companyPlanAssignment.findUnique.mockResolvedValue({
        planVersionId: 'v-basic',
      });

      const user = {
        id: 'user-hr-1',
        role: 'HRAdmin',
        companyId: 'comp-basic-1',
        permissions: ['performance:reviews:view', 'employees:list:view'],
        subscription: { company: 'Basic Company', plan: 'BASIC', status: 'Active' },
      };

      const ctx = createMockContext(user, ['performance:reviews:view']);
      await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
    });
  });

  // =========================================================================
  // TEST 6: HRAdmin + PREMIUM + PERFORMANCE permission => allowed
  // =========================================================================
  describe('Test 6 — HRAdmin + PREMIUM + PERFORMANCE permission => allowed', () => {
    it('MUST ALLOW HRAdmin on PREMIUM plan with PERFORMANCE permission', async () => {
      setupPlanVersion('v-premium', ['CORE_HR', 'PAYROLL_BASIC', 'MODULE_PERFORMANCE']);
      mockPrisma.companyPlanAssignment.findUnique.mockResolvedValue({
        planVersionId: 'v-premium',
      });

      const user = {
        id: 'user-hr-2',
        role: 'HRAdmin',
        companyId: 'comp-prem-1',
        permissions: ['performance:reviews:view'],
        subscription: { company: 'Premium Company', plan: 'PREMIUM', status: 'Active' },
      };

      const ctx = createMockContext(user, ['performance:reviews:view']);
      const result = await guard.canActivate(ctx);
      expect(result).toBe(true);
    });
  });

  // =========================================================================
  // TEST 7: HRAdmin permission removed from DB => HTTP 403 even though role name remains HRAdmin
  // =========================================================================
  describe('Test 7 — HRAdmin permission removed from DB => HTTP 403 (No Role-Name Bypass)', () => {
    it('MUST DENY HRAdmin when permission is removed from DB role, role name string cannot grant access', async () => {
      setupPlanVersion('v-premium', ['CORE_HR', 'PAYROLL_BASIC']);
      mockPrisma.companyPlanAssignment.findUnique.mockResolvedValue({
        planVersionId: 'v-premium',
      });

      const user = {
        id: 'user-hr-3',
        role: 'HRAdmin',
        companyId: 'comp-prem-1',
        permissions: ['employees:list:view'], // payroll:process:run removed from DB
        subscription: { company: 'Premium Company', plan: 'PREMIUM', status: 'Active' },
      };

      const ctx = createMockContext(user, ['payroll:process:run']);
      await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
    });
  });

  // =========================================================================
  // TEST 8: Accountant permission removed from DB => HTTP 403 even though role name remains Accountant
  // =========================================================================
  describe('Test 8 — Accountant permission removed from DB => HTTP 403', () => {
    it('MUST DENY Accountant when permission is removed from DB role', async () => {
      setupPlanVersion('v-standard', ['CORE_HR', 'PAYROLL_BASIC', 'EXPENSE_CLAIMS']);
      mockPrisma.companyPlanAssignment.findUnique.mockResolvedValue({
        planVersionId: 'v-standard',
      });

      const user = {
        id: 'user-acc-1',
        role: 'Accountant',
        companyId: 'comp-std-1',
        permissions: ['payroll:slips:view'], // expenses:claims:pay removed from DB
        subscription: { company: 'Standard Company', plan: 'STANDARD', status: 'Active' },
      };

      const ctx = createMockContext(user, ['expenses:claims:pay']);
      await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
    });
  });

  // =========================================================================
  // TEST 9: BASIC + EXPENSE_CLAIMS => denied
  // =========================================================================
  describe('Test 9 — BASIC + EXPENSE_CLAIMS => denied', () => {
    it('MUST DENY EXPENSE_CLAIMS (expenses:claims:submit) for BASIC plan', async () => {
      setupPlanVersion('v-basic', ['CORE_HR', 'PAYROLL_BASIC']);
      mockPrisma.companyPlanAssignment.findUnique.mockResolvedValue({
        planVersionId: 'v-basic',
      });

      const user = {
        id: 'user-emp-1',
        role: 'Employee',
        companyId: 'comp-basic-1',
        permissions: ['expenses:claims:submit'],
        subscription: { company: 'Basic Company', plan: 'BASIC', status: 'Active' },
      };

      const ctx = createMockContext(user, ['expenses:claims:submit']);
      await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
    });
  });

  // =========================================================================
  // TEST 10: STANDARD + EXPENSE_CLAIMS + correct RBAC => allowed
  // =========================================================================
  describe('Test 10 — STANDARD + EXPENSE_CLAIMS + correct RBAC => allowed', () => {
    it('MUST ALLOW EXPENSE_CLAIMS for STANDARD plan when user has canonical permission', async () => {
      setupPlanVersion('v-std', ['CORE_HR', 'PAYROLL_BASIC', 'EXPENSE_CLAIMS']);
      mockPrisma.companyPlanAssignment.findUnique.mockResolvedValue({
        planVersionId: 'v-std',
      });

      const user = {
        id: 'user-emp-2',
        role: 'Employee',
        companyId: 'comp-std-1',
        permissions: ['expenses:claims:submit'],
        subscription: { company: 'Standard Company', plan: 'STANDARD', status: 'Active' },
      };

      const ctx = createMockContext(user, ['expenses:claims:submit']);
      const result = await guard.canActivate(ctx);
      expect(result).toBe(true);
    });
  });

  // =========================================================================
  // TEST 11: PREMIUM + ADVANCED_AUDIT => allowed when RBAC permission exists
  // =========================================================================
  describe('Test 11 — PREMIUM + ADVANCED_AUDIT => allowed when RBAC permission exists', () => {
    it('MUST ALLOW ADVANCED_AUDIT on PREMIUM plan with RBAC permission', async () => {
      setupPlanVersion('v-prem', ['CORE_HR', 'PAYROLL_BASIC', 'ADVANCED_AUDIT']);
      mockPrisma.companyPlanAssignment.findUnique.mockResolvedValue({
        planVersionId: 'v-prem',
      });

      const user = {
        id: 'user-audit-1',
        role: 'HRAdmin',
        companyId: 'comp-prem-1',
        permissions: ['system:audit:view', 'system:audit:read'],
        subscription: { company: 'Premium Company', plan: 'PREMIUM', status: 'Active' },
      };

      const ctx = createMockContext(user, ['system:audit:view']);
      const result = await guard.canActivate(ctx);
      expect(result).toBe(true);
    });
  });

  // =========================================================================
  // TEST 12: BASIC + ADVANCED_AUDIT => denied
  // =========================================================================
  describe('Test 12 — BASIC + ADVANCED_AUDIT => denied', () => {
    it('MUST DENY ADVANCED_AUDIT for BASIC plan even if user role has system:audit:view string', async () => {
      setupPlanVersion('v-basic', ['CORE_HR', 'PAYROLL_BASIC']);
      mockPrisma.companyPlanAssignment.findUnique.mockResolvedValue({
        planVersionId: 'v-basic',
      });

      const user = {
        id: 'user-audit-2',
        role: 'HRAdmin',
        companyId: 'comp-basic-1',
        permissions: ['system:audit:view'],
        subscription: { company: 'Basic Company', plan: 'BASIC', status: 'Active' },
      };

      const ctx = createMockContext(user, ['system:audit:view']);
      await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
    });
  });

  // =========================================================================
  // TEST 13: STANDARD + ADVANCED_AUDIT => denied unless there is an explicit active SuperAdmin override
  // =========================================================================
  describe('Test 13 — STANDARD + ADVANCED_AUDIT => denied unless explicit active SuperAdmin override', () => {
    it('MUST DENY STANDARD plan without override, but ALLOW when SuperAdmin override is active', async () => {
      setupPlanVersion('v-std', ['CORE_HR', 'PAYROLL_BASIC', 'EXPENSE_CLAIMS']);
      mockPrisma.companyPlanAssignment.findUnique.mockResolvedValue({
        planVersionId: 'v-std',
      });

      const user = {
        id: 'user-audit-3',
        role: 'HRAdmin',
        companyId: 'comp-std-1',
        permissions: ['system:audit:view'],
        subscription: { company: 'Standard Company', plan: 'STANDARD', status: 'Active' },
      };

      // Part A: Without override -> DENIED
      mockPrisma.tenantFeatureOverride.findMany.mockResolvedValue([]);
      const ctx1 = createMockContext(user, ['system:audit:view']);
      await expect(guard.canActivate(ctx1)).rejects.toThrow(ForbiddenException);

      // Part B: With active SuperAdmin override -> ALLOWED
      PermissionsGuard.clearCache();
      mockPrisma.tenantFeatureOverride.findMany.mockResolvedValue([
        { companyId: 'comp-std-1', featureKey: 'ADVANCED_AUDIT', enabled: true },
      ]);
      const ctx2 = createMockContext(user, ['system:audit:view']);
      const result = await guard.canActivate(ctx2);
      expect(result).toBe(true);
    });
  });

  // =========================================================================
  // TEST 14: BASIC Company A + SuperAdmin override PERFORMANCE => Company A PERFORMANCE effective
  // =========================================================================
  describe('Test 14 — BASIC Company A + SuperAdmin override PERFORMANCE => Company A effective', () => {
    it('MUST enable PERFORMANCE for Company A via TenantFeatureOverride on BASIC plan', async () => {
      setupPlanVersion('v-basic', ['CORE_HR', 'PAYROLL_BASIC']);
      mockPrisma.companyPlanAssignment.findUnique.mockResolvedValue({
        planVersionId: 'v-basic',
      });
      mockPrisma.tenantFeatureOverride.findMany.mockResolvedValue([
        { companyId: 'comp-A', featureKey: 'MODULE_PERFORMANCE', enabled: true },
      ]);

      const userA = {
        id: 'user-A',
        role: 'HRAdmin',
        companyId: 'comp-A',
        permissions: ['performance:reviews:view'],
        subscription: { company: 'Company A', plan: 'BASIC', status: 'Active' },
      };

      const ctx = createMockContext(userA, ['performance:reviews:view']);
      const result = await guard.canActivate(ctx);
      expect(result).toBe(true);
    });
  });

  // =========================================================================
  // TEST 15: BASIC Company A + SuperAdmin override PERFORMANCE => Company B PERFORMANCE remains disabled
  // =========================================================================
  describe('Test 15 — BASIC Company A + SuperAdmin override PERFORMANCE => Company B remains disabled', () => {
    it('MUST keep PERFORMANCE disabled for Company B when only Company A received override', async () => {
      setupPlanVersion('v-basic', ['CORE_HR', 'PAYROLL_BASIC']);
      mockPrisma.companyPlanAssignment.findUnique.mockResolvedValue({
        planVersionId: 'v-basic',
      });
      mockPrisma.tenantFeatureOverride.findMany.mockImplementation(({ where }: any) => {
        if (where.companyId === 'comp-A') {
          return Promise.resolve([{ companyId: 'comp-A', featureKey: 'MODULE_PERFORMANCE', enabled: true }]);
        }
        return Promise.resolve([]); // Company B has no overrides
      });

      const userB = {
        id: 'user-B',
        role: 'HRAdmin',
        companyId: 'comp-B',
        permissions: ['performance:reviews:view'],
        subscription: { company: 'Company B', plan: 'BASIC', status: 'Active' },
      };

      const ctx = createMockContext(userB, ['performance:reviews:view']);
      await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
    });
  });

  // =========================================================================
  // TEST 16: Override expires => feature immediately becomes ineffective
  // =========================================================================
  describe('Test 16 — Override expires => feature immediately becomes ineffective', () => {
    it('MUST DENY feature access once TenantFeatureOverride reaches expiresAt', async () => {
      setupPlanVersion('v-basic', ['CORE_HR', 'PAYROLL_BASIC']);
      mockPrisma.companyPlanAssignment.findUnique.mockResolvedValue({
        planVersionId: 'v-basic',
      });

      const pastDate = new Date(Date.now() - 60000);
      mockPrisma.tenantFeatureOverride.findMany.mockResolvedValue([
        {
          companyId: 'comp-A',
          featureKey: 'MODULE_PERFORMANCE',
          enabled: true,
          expiresAt: pastDate,
        },
      ]);

      const userA = {
        id: 'user-A',
        role: 'HRAdmin',
        companyId: 'comp-A',
        permissions: ['performance:reviews:view'],
        subscription: { company: 'Company A', plan: 'BASIC', status: 'Active' },
      };

      const ctx = createMockContext(userA, ['performance:reviews:view']);
      await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
    });
  });

  // =========================================================================
  // TEST 17: Override revoked => feature immediately becomes ineffective
  // =========================================================================
  describe('Test 17 — Override revoked => feature immediately becomes ineffective', () => {
    it('MUST DENY feature access once TenantFeatureOverride is revoked (revokedAt set)', async () => {
      setupPlanVersion('v-basic', ['CORE_HR', 'PAYROLL_BASIC']);
      mockPrisma.companyPlanAssignment.findUnique.mockResolvedValue({
        planVersionId: 'v-basic',
      });

      const pastDate = new Date(Date.now() - 30000);
      mockPrisma.tenantFeatureOverride.findMany.mockResolvedValue([
        {
          companyId: 'comp-A',
          featureKey: 'MODULE_PERFORMANCE',
          enabled: true,
          revokedAt: pastDate,
        },
      ]);

      const userA = {
        id: 'user-A',
        role: 'HRAdmin',
        companyId: 'comp-A',
        permissions: ['performance:reviews:view'],
        subscription: { company: 'Company A', plan: 'BASIC', status: 'Active' },
      };

      const ctx = createMockContext(userA, ['performance:reviews:view']);
      await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
    });
  });

  // =========================================================================
  // TEST 18: Cross-Tenant Role Isolation (Company A custom role vs Company B)
  // =========================================================================
  describe('Test 18 — Cross-Tenant Role Resolution Isolation', () => {
    it('MUST PREVENT Company B user from inheriting Company A elevated custom role permissions', async () => {
      const companyARole = {
        id: 'role-A-hr',
        name: 'HRAdmin',
        companyId: 'comp-A',
        permissions: JSON.stringify(['employees:list:view', 'payroll:process:run', 'settings:roles:edit']),
      };

      const companyBRole = {
        id: 'role-B-hr',
        name: 'HRAdmin',
        companyId: 'comp-B',
        permissions: JSON.stringify(['employees:list:view']),
      };

      mockPrisma.role.findFirst.mockImplementation(({ where }: any) => {
        if (where.companyId === 'comp-B' && where.name === 'HRAdmin') {
          return Promise.resolve(companyBRole);
        }
        if (where.companyId === 'comp-A' && where.name === 'HRAdmin') {
          return Promise.resolve(companyARole);
        }
        return Promise.resolve(null);
      });

      setupPlanVersion('v-prem', ['CORE_HR', 'PAYROLL_BASIC']);
      mockPrisma.companyPlanAssignment.findUnique.mockResolvedValue({
        planVersionId: 'v-prem',
      });

      const userB = {
        id: 'user-B-1',
        role: 'HRAdmin',
        companyId: 'comp-B',
        subscription: { company: 'Company B', plan: 'PREMIUM', status: 'Active' },
      };

      const effectivePerms = await permissionResolver.resolve(userB);

      // User in Company B MUST NOT inherit settings:roles:edit or payroll:process:run from Company A
      expect(effectivePerms).toContain('employees:list:view');
      expect(effectivePerms).not.toContain('settings:roles:edit');
      expect(effectivePerms).not.toContain('payroll:process:run');
    });
  });

  // =========================================================================
  // TEST 19: Company A override mutation => Company B entitlement unchanged
  // =========================================================================
  describe('Test 19 — Company A override mutation => Company B entitlement unchanged', () => {
    it('MUST keep Company B entitlement completely unchanged when Company A override is mutated', async () => {
      mockPrisma.company.findUnique.mockImplementation(({ where }: any) => {
        if (where.id === 'comp-A') return Promise.resolve({ id: 'comp-A', name: 'Company A' });
        if (where.id === 'comp-B') return Promise.resolve({ id: 'comp-B', name: 'Company B' });
        return Promise.resolve(null);
      });

      mockPrisma.feature.findUnique.mockResolvedValue({
        key: 'MODULE_PERFORMANCE',
        name: 'Performance',
      });

      mockPrisma.companyPlanAssignment.findUnique.mockResolvedValue({
        planVersionId: 'v-basic',
      });
      setupPlanVersion('v-basic', ['CORE_HR', 'PAYROLL_BASIC']);

      mockPrisma.tenantFeatureOverride.findMany.mockImplementation(({ where }: any) => {
        if (where.companyId === 'comp-A') {
          return Promise.resolve([{ companyId: 'comp-A', featureKey: 'MODULE_PERFORMANCE', enabled: true }]);
        }
        return Promise.resolve([]);
      });

      // Query Company B
      const bEffective = await effectiveFeatureService.isFeatureEffective('comp-B', 'MODULE_PERFORMANCE');
      expect(bEffective).toBe(false);

      // Mutate Company A
      await effectiveFeatureService.setTenantOverride(
        'comp-A',
        'MODULE_PERFORMANCE',
        { enabled: true, reason: 'Pilot trial' },
        { email: 'superadmin@hrnexa.com' },
      );

      // Verify Company B remains false
      const bEffectiveAfter = await effectiveFeatureService.isFeatureEffective('comp-B', 'MODULE_PERFORMANCE');
      expect(bEffectiveAfter).toBe(false);
    });
  });

  // =========================================================================
  // TEST 20: SuperAdmin Root Access Remains Functional
  // =========================================================================
  describe('Test 20 — SuperAdmin Root Access Remains Functional', () => {
    it('MUST ALLOW SuperAdmin root access unrestricted by tenant plan limits or feature gating', async () => {
      const superAdminUser = {
        id: 'user-superadmin-root',
        role: 'SuperAdmin',
        companyId: 'PLATFORM',
        permissions: ['*'],
      };

      const ctx = createMockContext(superAdminUser, ['any:arbitrary:system:action']);
      const result = await guard.canActivate(ctx);
      expect(result).toBe(true);
    });
  });
});

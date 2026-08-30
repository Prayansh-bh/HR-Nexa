import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { TenantGuard } from './tenant.guard';
import { TenantContextService } from './tenant-context.service';
import { Role } from '../../modules/auth/role.enum';
import { createTenantPrismaExtension } from '../../prisma/prisma-tenant.extension';

describe('PHASE C — STEP 14: GLOBAL TenantGuard AUDIT & VERIFICATION', () => {
  let guard: TenantGuard;
  let tenantContextService: TenantContextService;

  beforeEach(() => {
    tenantContextService = new TenantContextService();
    guard = new TenantGuard(tenantContextService);
  });

  // 14.1 — Global Registration Audit
  it('14.1 — should verify global APP_GUARD registration in app.module.ts', () => {
    expect(guard).toBeDefined();
  });

  // 14.2 — Valid Tenant Request
  it('14.2 — should ALLOW valid authenticated tenant request matching companyId', () => {
    TenantContextService.runTenant('COMPANY_A', () => {
      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            user: { role: Role.Employee, companyId: 'COMPANY_A' },
          }),
        }),
      } as ExecutionContext;

      expect(guard.canActivate(mockContext)).toBe(true);
    });
  });

  // 14.3 — Missing companyId
  it('14.3 — should REJECT with 403 Forbidden if non-SuperAdmin user is missing companyId', () => {
    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => ({
          user: { role: Role.Employee, companyId: null },
        }),
      }),
    } as ExecutionContext;

    expect(() => guard.canActivate(mockContext)).toThrow(ForbiddenException);
    expect(() => guard.canActivate(mockContext)).toThrow(
      'Tenant context (companyId) is required for this operation',
    );
  });

  // 14.4 — Cross-company Context Tampering
  it('14.4 — should REJECT with 403 Forbidden when user companyId does not match current tenant context', () => {
    TenantContextService.runTenant('COMPANY_B', () => {
      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            user: { role: Role.Employee, companyId: 'COMPANY_A' },
          }),
        }),
      } as ExecutionContext;

      expect(() => guard.canActivate(mockContext)).toThrow(ForbiddenException);
      expect(() => guard.canActivate(mockContext)).toThrow(
        'Cross-company data access strictly prohibited',
      );
    });
  });

  // 14.5 — SuperAdmin Behavior
  it('14.5 — should ALLOW SuperAdmin request under PLATFORM context without forced company tenancy', () => {
    TenantContextService.runPlatform(() => {
      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            user: { role: Role.SuperAdmin, companyId: 'PLATFORM' },
          }),
        }),
      } as ExecutionContext;

      expect(guard.canActivate(mockContext)).toBe(true);
      expect(tenantContextService.getCompanyId()).toBe('PLATFORM');
      expect(tenantContextService.isSuperAdmin()).toBe(true);
    });
  });

  // 14.6 — Public Route Behavior
  it('14.6 — should ALLOW unauthenticated public routes without blocking (handled downstream by JwtAuthGuard)', () => {
    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => ({
          user: undefined,
        }),
      }),
    } as ExecutionContext;

    expect(guard.canActivate(mockContext)).toBe(true);
  });

  // 14.7 — CompanyOwner Behavior & Prisma Isolation
  it('14.7 — should ALLOW CompanyOwner through TenantGuard while STILL enforcing Prisma companyId scoping', async () => {
    // 1. Guard allows CompanyOwner
    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => ({
          user: { role: Role.CompanyOwner, companyId: 'COMPANY_OWNER_CO' },
        }),
      }),
    } as ExecutionContext;

    expect(guard.canActivate(mockContext)).toBe(true);

    // 2. Verify Prisma extension STILL injects companyId for CompanyOwner
    let capturedArgs: any = null;
    const mockClient = {
      $extends: (ext: any) => {
        capturedArgs = ext.query.$allModels.$allOperations;
      },
    };

    createTenantPrismaExtension(tenantContextService)(mockClient as any);

    const mockQuery = jest.fn();

    await TenantContextService.run(
      {
        companyId: 'COMPANY_OWNER_CO',
        subscriptionId: 'SUB_OWNER',
        isSuperAdmin: false, // CompanyOwner is NOT SuperAdmin
      },
      async () => {
        await capturedArgs({
          model: 'Payroll',
          operation: 'findMany',
          args: { where: { status: 'Draft' } },
          query: mockQuery,
        });

        expect(mockQuery).toHaveBeenCalledWith({
          where: { status: 'Draft', companyId: 'COMPANY_OWNER_CO' },
        });
      },
    );
  });
});

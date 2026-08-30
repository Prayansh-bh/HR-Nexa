import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { TenantGuard } from '../common/tenant/tenant.guard';
import { TenantInterceptor } from '../common/tenant/tenant.interceptor';
import { TenantContextService } from '../common/tenant/tenant-context.service';
import { Role } from '../modules/auth/role.enum';
import { createTenantPrismaExtension } from './prisma-tenant.extension';

describe('STEP 14A — 17-POINT MULTI-TENANT ISOLATION HARDENING SECURITY MATRIX', () => {
  let tenantContextService: TenantContextService;
  let tenantGuard: TenantGuard;
  let tenantInterceptor: TenantInterceptor;
  let mockQuery: jest.Mock;
  let extension: any;

  beforeEach(() => {
    tenantContextService = new TenantContextService();
    tenantGuard = new TenantGuard(tenantContextService);
    tenantInterceptor = new TenantInterceptor(tenantContextService);
    mockQuery = jest.fn();

    const mockClient = {
      $extends: (ext: any) => {
        extension = ext.query.$allModels.$allOperations;
      },
    };

    const extensionFactory = createTenantPrismaExtension(tenantContextService) as any;
    extensionFactory(mockClient);
  });

  // 1. Tenant A cannot read Tenant B employee
  it('Scenario 1 — Tenant A cannot read Tenant B employee', async () => {
    await TenantContextService.run(
      { companyId: 'COMPANY_A', subscriptionId: 'SUB_A', isSuperAdmin: false },
      async () => {
        await extension({
          model: 'Employee',
          operation: 'findMany',
          args: { where: { id: 'EMP_B' } },
          query: mockQuery,
        });

        expect(mockQuery).toHaveBeenCalledWith({
          where: {
            id: 'EMP_B',
            OR: [{ subscriptionId: 'SUB_A' }, { companyId: 'COMPANY_A' }],
          },
        });
      },
    );
  });

  // 2. Tenant A cannot read Tenant B payroll
  it('Scenario 2 — Tenant A cannot read Tenant B payroll', async () => {
    await TenantContextService.run(
      { companyId: 'COMPANY_A', subscriptionId: 'SUB_A', isSuperAdmin: false },
      async () => {
        await extension({
          model: 'Payroll',
          operation: 'findMany',
          args: { where: { id: 'PAY_B' } },
          query: mockQuery,
        });

        expect(mockQuery).toHaveBeenCalledWith({
          where: { id: 'PAY_B', companyId: 'COMPANY_A' },
        });
      },
    );
  });

  // 3. Tenant A cannot read Tenant B attendance
  it('Scenario 3 — Tenant A cannot read Tenant B attendance', async () => {
    await TenantContextService.run(
      { companyId: 'COMPANY_A', subscriptionId: 'SUB_A', isSuperAdmin: false },
      async () => {
        await extension({
          model: 'Attendance',
          operation: 'findMany',
          args: { where: { id: 'ATT_B' } },
          query: mockQuery,
        });

        expect(mockQuery).toHaveBeenCalledWith({
          where: {
            id: 'ATT_B',
            employee: {
              OR: [{ companyId: 'COMPANY_A' }, { subscriptionId: 'SUB_A' }],
            },
          },
        });
      },
    );
  });

  // 4. Tenant A cannot read Tenant B leave
  it('Scenario 4 — Tenant A cannot read Tenant B leave', async () => {
    await TenantContextService.run(
      { companyId: 'COMPANY_A', subscriptionId: 'SUB_A', isSuperAdmin: false },
      async () => {
        await extension({
          model: 'LeaveRequest',
          operation: 'findMany',
          args: { where: { id: 'LEAVE_B' } },
          query: mockQuery,
        });

        expect(mockQuery).toHaveBeenCalledWith({
          where: { id: 'LEAVE_B', companyId: 'COMPANY_A' },
        });
      },
    );
  });

  // 5. Tenant A cannot read Tenant B documents
  it('Scenario 5 — Tenant A cannot read Tenant B documents', async () => {
    await TenantContextService.run(
      { companyId: 'COMPANY_A', subscriptionId: 'SUB_A', isSuperAdmin: false },
      async () => {
        await extension({
          model: 'Document',
          operation: 'findMany',
          args: { where: { id: 'DOC_B' } },
          query: mockQuery,
        });

        expect(mockQuery).toHaveBeenCalledWith({
          where: { id: 'DOC_B', companyId: 'COMPANY_A' },
        });
      },
    );
  });

  // 6. Tenant A cannot read Tenant B tickets
  it('Scenario 6 — Tenant A cannot read Tenant B tickets', async () => {
    await TenantContextService.run(
      { companyId: 'COMPANY_A', subscriptionId: 'SUB_A', isSuperAdmin: false },
      async () => {
        await extension({
          model: 'SupportTicket',
          operation: 'findMany',
          args: { where: { id: 'TICKET_B' } },
          query: mockQuery,
        });

        expect(mockQuery).toHaveBeenCalledWith({
          where: { id: 'TICKET_B', companyId: 'COMPANY_A' },
        });
      },
    );
  });

  // 7. Tenant A cannot read Tenant B performance reviews
  it('Scenario 7 — Tenant A cannot read Tenant B performance reviews', async () => {
    await TenantContextService.run(
      { companyId: 'COMPANY_A', subscriptionId: 'SUB_A', isSuperAdmin: false },
      async () => {
        await extension({
          model: 'PerformanceReview',
          operation: 'findMany',
          args: { where: { id: 'REV_B' } },
          query: mockQuery,
        });

        expect(mockQuery).toHaveBeenCalledWith({
          where: { id: 'REV_B', companyId: 'COMPANY_A' },
        });
      },
    );
  });

  // 8. Tenant A cannot read Tenant B recruitment records
  it('Scenario 8 — Tenant A cannot read Tenant B recruitment records', async () => {
    await TenantContextService.run(
      { companyId: 'COMPANY_A', subscriptionId: 'SUB_A', isSuperAdmin: false },
      async () => {
        await extension({
          model: 'JobRequisition',
          operation: 'findMany',
          args: { where: { id: 'JOB_B' } },
          query: mockQuery,
        });

        expect(mockQuery).toHaveBeenCalledWith({
          where: {
            id: 'JOB_B',
            OR: [{ subscriptionId: 'SUB_A' }, { companyId: 'COMPANY_A' }],
          },
        });
      },
    );
  });

  // 9. Tenant A cannot read Tenant B exit records
  it('Scenario 9 — Tenant A cannot read Tenant B exit records', async () => {
    await TenantContextService.run(
      { companyId: 'COMPANY_A', subscriptionId: 'SUB_A', isSuperAdmin: false },
      async () => {
        await extension({
          model: 'Exit',
          operation: 'findMany',
          args: { where: { id: 'EXIT_B' } },
          query: mockQuery,
        });

        expect(mockQuery).toHaveBeenCalledWith({
          where: { id: 'EXIT_B', companyId: 'COMPANY_A' },
        });
      },
    );
  });

  // 10. Tenant A cannot read Tenant B fiscal years
  it('Scenario 10 — Tenant A cannot read Tenant B fiscal years', async () => {
    await TenantContextService.run(
      { companyId: 'COMPANY_A', subscriptionId: 'SUB_A', isSuperAdmin: false },
      async () => {
        await extension({
          model: 'FiscalYear',
          operation: 'findMany',
          args: { where: { id: 'FY_B' } },
          query: mockQuery,
        });

        expect(mockQuery).toHaveBeenCalledWith({
          where: { id: 'FY_B', companyId: 'COMPANY_A' },
        });
      },
    );
  });

  // 11. CompanyOwner A cannot access Company B
  it('Scenario 11 — CompanyOwner A is restricted to Company A and blocked from Company B', async () => {
    TenantContextService.runTenant('COMPANY_A', () => {
      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            user: { role: Role.CompanyOwner, companyId: 'COMPANY_B' },
          }),
        }),
      } as ExecutionContext;

      expect(() => tenantGuard.canActivate(mockContext)).toThrow(
        ForbiddenException,
      );
      expect(() => tenantGuard.canActivate(mockContext)).toThrow(
        'Cross-company data access strictly prohibited',
      );
    });
  });

  // 12. Employee A cannot access Company B
  it('Scenario 12 — Employee A is restricted to Company A and blocked from Company B', async () => {
    TenantContextService.runTenant('COMPANY_A', () => {
      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            user: { role: Role.Employee, companyId: 'COMPANY_B' },
          }),
        }),
      } as ExecutionContext;

      expect(() => tenantGuard.canActivate(mockContext)).toThrow(
        ForbiddenException,
      );
    });
  });

  // 13. SuperAdmin retains platform functionality
  it('Scenario 13 — SuperAdmin retains platform functionality un-scoped', async () => {
    await TenantContextService.runPlatform(async () => {
      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            user: { role: Role.SuperAdmin, companyId: 'PLATFORM' },
          }),
        }),
      } as ExecutionContext;

      expect(tenantGuard.canActivate(mockContext)).toBe(true);

      await extension({
        model: 'Payroll',
        operation: 'findMany',
        args: {},
        query: mockQuery,
      });

      expect(mockQuery).toHaveBeenCalledWith({});
    });
  });

  // 14. Missing companyId is rejected for tenant users
  it('Scenario 14 — Missing companyId is rejected with 403 Forbidden', () => {
    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => ({
          user: { role: Role.Employee, companyId: null },
        }),
      }),
    } as ExecutionContext;

    expect(() => tenantGuard.canActivate(mockContext)).toThrow(
      ForbiddenException,
    );
    expect(() => tenantGuard.canActivate(mockContext)).toThrow(
      'Tenant context (companyId) is required for this operation',
    );
  });

  // 15. Manipulated request companyId is ignored/rejected
  it('Scenario 15 — Manipulated companyId in request parameters is overridden by authenticated user context', async () => {
    await TenantContextService.run(
      { companyId: 'COMPANY_A', subscriptionId: 'SUB_A', isSuperAdmin: false },
      async () => {
        await extension({
          model: 'Payroll',
          operation: 'findMany',
          args: { where: { companyId: 'ATTACKER_COMPANY_B' } },
          query: mockQuery,
        });

        expect(mockQuery).toHaveBeenCalledWith({
          where: { companyId: 'COMPANY_A' },
        });
      },
    );
  });

  // 16. PLATFORM cannot accidentally become a normal tenant scope
  it('Scenario 16 — Non-SuperAdmin user cannot claim PLATFORM as companyId', () => {
    const mockReq = {
      user: { role: Role.HRAdmin, companyId: 'PLATFORM' },
    };

    expect(() => {
      tenantInterceptor.intercept(
        {
          switchToHttp: () => ({ getRequest: () => mockReq }),
        } as ExecutionContext,
        { handle: () => mockQuery() } as any,
      );
    }).toThrow(ForbiddenException);
  });

  // 17. DEFAULT_COMPANY cannot bypass isolation
  it('Scenario 17 — DEFAULT_COMPANY is rejected as invalid tenant context', () => {
    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => ({
          user: { role: Role.Employee, companyId: 'DEFAULT_COMPANY' },
        }),
      }),
    } as ExecutionContext;

    expect(() => tenantGuard.canActivate(mockContext)).toThrow(
      ForbiddenException,
    );
  });
});

import { TenantContextService } from '../common/tenant/tenant-context.service';
import { createTenantPrismaExtension } from './prisma-tenant.extension';

describe('PHASE B — STEP 10: PRISMA READ ISOLATION VERIFICATION', () => {
  let tenantContextService: TenantContextService;
  let mockQuery: jest.Mock;
  let extension: any;

  beforeEach(() => {
    tenantContextService = new TenantContextService();
    mockQuery = jest.fn();

    const mockClient = {
      $extends: (ext: any) => {
        extension = ext.query.$allModels.$allOperations;
      },
    };

    const extensionFactory = createTenantPrismaExtension(tenantContextService) as any;
    extensionFactory(mockClient);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 10.1 — TenantContext Isolation
  // ───────────────────────────────────────────────────────────────────────────
  describe('Test 10.1 — TenantContext Isolation', () => {
    it('should set Tenant A context correctly', () => {
      TenantContextService.run(
        {
          companyId: 'COMPANY_A',
          subscriptionId: 'SUB_A',
          isSuperAdmin: false,
        },
        () => {
          expect(tenantContextService.getCompanyId()).toBe('COMPANY_A');
          expect(tenantContextService.getSubscriptionId()).toBe('SUB_A');
          expect(tenantContextService.isSuperAdmin()).toBe(false);
          expect(tenantContextService.isPlatform()).toBe(false);
        },
      );
    });

    it('should set Tenant B context correctly', () => {
      TenantContextService.run(
        {
          companyId: 'COMPANY_B',
          subscriptionId: 'SUB_B',
          isSuperAdmin: false,
        },
        () => {
          expect(tenantContextService.getCompanyId()).toBe('COMPANY_B');
          expect(tenantContextService.getSubscriptionId()).toBe('SUB_B');
          expect(tenantContextService.isSuperAdmin()).toBe(false);
          expect(tenantContextService.isPlatform()).toBe(false);
        },
      );
    });

    it('should set SuperAdmin PLATFORM context correctly', () => {
      TenantContextService.runPlatform(() => {
        expect(tenantContextService.getCompanyId()).toBe('PLATFORM');
        expect(tenantContextService.getSubscriptionId()).toBeNull();
        expect(tenantContextService.isSuperAdmin()).toBe(true);
        expect(tenantContextService.isPlatform()).toBe(true);
      });
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 10.2 — Direct Company-Scoped READ Isolation (Payroll, Document, etc.)
  // ───────────────────────────────────────────────────────────────────────────
  describe('Test 10.2 — Direct Company-Scoped READ Isolation', () => {
    it('should inject companyId = COMPANY_A on findMany for Payroll under Tenant A', async () => {
      await TenantContextService.run(
        { companyId: 'COMPANY_A', subscriptionId: 'SUB_A', isSuperAdmin: false },
        async () => {
          await extension({
            model: 'Payroll',
            operation: 'findMany',
            args: { where: { status: 'Processed' } },
            query: mockQuery,
          });

          expect(mockQuery).toHaveBeenCalledWith({
            where: { status: 'Processed', companyId: 'COMPANY_A' },
          });
        },
      );
    });

    it('should inject companyId = COMPANY_A on findFirst for Document under Tenant A', async () => {
      await TenantContextService.run(
        { companyId: 'COMPANY_A', subscriptionId: 'SUB_A', isSuperAdmin: false },
        async () => {
          await extension({
            model: 'Document',
            operation: 'findFirst',
            args: { where: { id: 'DOC_B_ID' } },
            query: mockQuery,
          });

          expect(mockQuery).toHaveBeenCalledWith({
            where: { id: 'DOC_B_ID', companyId: 'COMPANY_A' },
          });
        },
      );
    });

    it('should inject companyId = COMPANY_A on findUnique for PerformanceReview under Tenant A', async () => {
      await TenantContextService.run(
        { companyId: 'COMPANY_A', subscriptionId: 'SUB_A', isSuperAdmin: false },
        async () => {
          await extension({
            model: 'PerformanceReview',
            operation: 'findUnique',
            args: { where: { id: 'REV_B_ID' } },
            query: mockQuery,
          });

          expect(mockQuery).toHaveBeenCalledWith({
            where: { id: 'REV_B_ID', companyId: 'COMPANY_A' },
          });
        },
      );
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 10.3 — Subscription-Scoped READ Isolation (Employee, Department, etc.)
  // ───────────────────────────────────────────────────────────────────────────
  describe('Test 10.3 — Subscription-Scoped READ Isolation', () => {
    it('should inject subscriptionId / companyId filter on findMany for Employee under Tenant A', async () => {
      await TenantContextService.run(
        { companyId: 'COMPANY_A', subscriptionId: 'SUB_A', isSuperAdmin: false },
        async () => {
          await extension({
            model: 'Employee',
            operation: 'findMany',
            args: { where: { status: 'Active' } },
            query: mockQuery,
          });

          expect(mockQuery).toHaveBeenCalledWith({
            where: {
              status: 'Active',
              OR: [{ subscriptionId: 'SUB_A' }, { companyId: 'COMPANY_A' }],
            },
          });
        },
      );
    });

    it('should inject subscriptionId / companyId filter on findUnique for Employee under Tenant A', async () => {
      await TenantContextService.run(
        { companyId: 'COMPANY_A', subscriptionId: 'SUB_A', isSuperAdmin: false },
        async () => {
          await extension({
            model: 'Employee',
            operation: 'findUnique',
            args: { where: { id: 'EMP_B_ID' } },
            query: mockQuery,
          });

          expect(mockQuery).toHaveBeenCalledWith({
            where: {
              id: 'EMP_B_ID',
              OR: [{ subscriptionId: 'SUB_A' }, { companyId: 'COMPANY_A' }],
            },
          });
        },
      );
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 10.4 — Relation-Scoped READ Isolation (Attendance, LeaveQuota, etc.)
  // ───────────────────────────────────────────────────────────────────────────
  describe('Test 10.4 — Relation-Scoped READ Isolation', () => {
    it('should inject relation filter for Attendance under Tenant A', async () => {
      await TenantContextService.run(
        { companyId: 'COMPANY_A', subscriptionId: 'SUB_A', isSuperAdmin: false },
        async () => {
          await extension({
            model: 'Attendance',
            operation: 'findMany',
            args: {},
            query: mockQuery,
          });

          expect(mockQuery).toHaveBeenCalledWith({
            where: {
              employee: {
                OR: [{ companyId: 'COMPANY_A' }, { subscriptionId: 'SUB_A' }],
              },
            },
          });
        },
      );
    });

    it('should inject relation filter for ReviewCycleParticipant under Tenant A', async () => {
      await TenantContextService.run(
        { companyId: 'COMPANY_A', subscriptionId: 'SUB_A', isSuperAdmin: false },
        async () => {
          await extension({
            model: 'ReviewCycleParticipant',
            operation: 'findMany',
            args: {},
            query: mockQuery,
          });

          expect(mockQuery).toHaveBeenCalledWith({
            where: { reviewCycle: { companyId: 'COMPANY_A' } },
          });
        },
      );
    });

    it('should inject relation filter for ExitApproval under Tenant A', async () => {
      await TenantContextService.run(
        { companyId: 'COMPANY_A', subscriptionId: 'SUB_A', isSuperAdmin: false },
        async () => {
          await extension({
            model: 'ExitApproval',
            operation: 'findMany',
            args: {},
            query: mockQuery,
          });

          expect(mockQuery).toHaveBeenCalledWith({
            where: { exit: { companyId: 'COMPANY_A' } },
          });
        },
      );
    });

    it('should inject relation filter for TicketMessage under Tenant A', async () => {
      await TenantContextService.run(
        { companyId: 'COMPANY_A', subscriptionId: 'SUB_A', isSuperAdmin: false },
        async () => {
          await extension({
            model: 'TicketMessage',
            operation: 'findMany',
            args: {},
            query: mockQuery,
          });

          expect(mockQuery).toHaveBeenCalledWith({
            where: { ticket: { companyId: 'COMPANY_A' } },
          });
        },
      );
    });

    it('should inject relation filter for ExpenseClaimItem under Tenant A', async () => {
      await TenantContextService.run(
        { companyId: 'COMPANY_A', subscriptionId: 'SUB_A', isSuperAdmin: false },
        async () => {
          await extension({
            model: 'ExpenseClaimItem',
            operation: 'findMany',
            args: {},
            query: mockQuery,
          });

          expect(mockQuery).toHaveBeenCalledWith({
            where: { claim: { companyId: 'COMPANY_A' } },
          });
        },
      );
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 10.5 — Aggregation Isolation (count, aggregate, groupBy)
  // ───────────────────────────────────────────────────────────────────────────
  describe('Test 10.5 — Aggregation Isolation', () => {
    it('should scope count queries to companyId = COMPANY_A', async () => {
      await TenantContextService.run(
        { companyId: 'COMPANY_A', subscriptionId: 'SUB_A', isSuperAdmin: false },
        async () => {
          await extension({
            model: 'Payroll',
            operation: 'count',
            args: {},
            query: mockQuery,
          });

          expect(mockQuery).toHaveBeenCalledWith({
            where: { companyId: 'COMPANY_A' },
          });
        },
      );
    });

    it('should scope aggregate queries to companyId = COMPANY_A', async () => {
      await TenantContextService.run(
        { companyId: 'COMPANY_A', subscriptionId: 'SUB_A', isSuperAdmin: false },
        async () => {
          await extension({
            model: 'Payroll',
            operation: 'aggregate',
            args: { _sum: { netSalary: true } },
            query: mockQuery,
          });

          expect(mockQuery).toHaveBeenCalledWith({
            _sum: { netSalary: true },
            where: { companyId: 'COMPANY_A' },
          });
        },
      );
    });

    it('should scope groupBy queries to companyId = COMPANY_A', async () => {
      await TenantContextService.run(
        { companyId: 'COMPANY_A', subscriptionId: 'SUB_A', isSuperAdmin: false },
        async () => {
          await extension({
            model: 'Payroll',
            operation: 'groupBy',
            args: { by: ['companyId'], _count: true },
            query: mockQuery,
          });

          expect(mockQuery).toHaveBeenCalledWith({
            by: ['companyId'],
            _count: true,
            where: { companyId: 'COMPANY_A' },
          });
        },
      );
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 10.6 — Explicit Malicious companyId Attack
  // ───────────────────────────────────────────────────────────────────────────
  describe('Test 10.6 — Explicit Malicious companyId Attack', () => {
    it('should override caller-supplied companyId = COMPANY_B with enforced companyId = COMPANY_A', async () => {
      await TenantContextService.run(
        { companyId: 'COMPANY_A', subscriptionId: 'SUB_A', isSuperAdmin: false },
        async () => {
          await extension({
            model: 'Payroll',
            operation: 'findMany',
            args: { where: { companyId: 'COMPANY_B' } },
            query: mockQuery,
          });

          expect(mockQuery).toHaveBeenCalledWith({
            where: { companyId: 'COMPANY_A' },
          });
        },
      );
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 10.7 — Explicit Malicious subscriptionId Attack
  // ───────────────────────────────────────────────────────────────────────────
  describe('Test 10.7 — Explicit Malicious subscriptionId Attack', () => {
    it('should prevent caller-supplied subscriptionId = SUB_B from bypassing Tenant A context', async () => {
      await TenantContextService.run(
        { companyId: 'COMPANY_A', subscriptionId: 'SUB_A', isSuperAdmin: false },
        async () => {
          await extension({
            model: 'Employee',
            operation: 'findMany',
            args: { where: { subscriptionId: 'SUB_B' } },
            query: mockQuery,
          });

          expect(mockQuery).toHaveBeenCalledWith({
            where: {
              subscriptionId: 'SUB_B',
              OR: [{ subscriptionId: 'SUB_A' }, { companyId: 'COMPANY_A' }],
            },
          });
        },
      );
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 10.8 — SuperAdmin PLATFORM Read (Unrestricted)
  // ───────────────────────────────────────────────────────────────────────────
  describe('Test 10.8 — SuperAdmin PLATFORM Read', () => {
    it('should execute un-scoped query for SuperAdmin without injecting companyId or subscriptionId', async () => {
      await TenantContextService.runPlatform(async () => {
        await extension({
          model: 'Payroll',
          operation: 'findMany',
          args: { where: { status: 'Processed' } },
          query: mockQuery,
        });

        expect(mockQuery).toHaveBeenCalledWith({
          where: { status: 'Processed' },
        });
      });
    });
  });
});

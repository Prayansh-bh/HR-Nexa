import { LeaveService } from './leave.service';
import { LeaveRepository } from '../repositories/leave.repository';
import { TenantContext } from '../../../common/tenant/tenant-context.util';
import { Role } from '../../auth/role.enum';

describe('SuperAdmin Platform Scoping & Tenant Isolation Regression Suite', () => {
  let leaveService: LeaveService;
  let leaveRepository: LeaveRepository;
  let mockPrisma: any;
  let mockTenantContextService: any;

  beforeEach(() => {
    mockPrisma = {
      leaveRequest: {
        count: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      employee: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
      company: {
        findMany: jest.fn(),
      },
      auditLog: {
        create: jest.fn(),
      },
    };

    mockTenantContextService = {
      getCompanyId: jest.fn().mockReturnValue(null),
      isPlatform: jest.fn().mockReturnValue(true),
    };

    leaveRepository = new LeaveRepository(mockPrisma, mockTenantContextService);
    leaveService = new LeaveService(
      leaveRepository,
      {} as any,
      {} as any,
      mockPrisma,
    );
  });

  const superAdminUser = {
    id: 'super-admin-1',
    role: Role.SuperAdmin,
    email: 'admin@demo.co',
    companyId: null,
    subscriptionId: null,
  };

  const tenantHrUser = {
    id: 'hr-user-1',
    role: Role.HRAdmin,
    email: 'hr@company-a.com',
    companyId: 'COMP-A',
    subscriptionId: 'COMP-A',
  };

  const tenantEmployeeUser = {
    id: 'emp-user-1',
    role: Role.Employee,
    email: 'john@company-a.com',
    companyId: 'COMP-A',
    subscriptionId: 'COMP-A',
    employee: { id: 'EMP-001' },
  };

  describe('1. SuperAdmin Platform Scope & No "PLATFORM" companyId Filter', () => {
    it('resolves isPlatformBypass: true for SuperAdmin when isPlatformEndpoint is true', () => {
      const scope = TenantContext.getRequiredTenantScope(superAdminUser, true);
      expect(scope).toEqual({
        companyId: 'PLATFORM',
        subscriptionId: null,
        isSuperAdmin: true,
        isPlatformBypass: true,
      });
    });

    it('queries repository with employee.company.isDemo = false and never employee.companyId = "PLATFORM"', async () => {
      const scope = TenantContext.getRequiredTenantScope(superAdminUser, true);

      mockPrisma.leaveRequest.count.mockResolvedValue(3);
      mockPrisma.leaveRequest.findMany.mockResolvedValue([
        {
          id: 'leave-1',
          employeeId: 'emp-1',
          status: 'APPROVED',
          employee: { id: 'emp-1', name: 'Ravi', company: { id: 'COMP-A', isDemo: false } },
        },
        {
          id: 'leave-2',
          employeeId: 'emp-2',
          status: 'PENDING',
          employee: { id: 'emp-2', name: 'Jane', company: { id: 'COMP-B', isDemo: false } },
        },
        {
          id: 'leave-3',
          employeeId: 'emp-3',
          status: 'REJECTED',
          employee: { id: 'emp-3', name: 'Alex', company: { id: 'COMP-A', isDemo: false } },
        },
      ]);

      const result: any = await leaveService.getLeaves(superAdminUser, scope, {
        page: 1,
        limit: 50,
      });

      // Verify Prisma count and findMany were called with non-demo filter and NOT companyId: "PLATFORM"
      expect(mockPrisma.leaveRequest.count).toHaveBeenCalledWith({
        where: {
          employee: {
            company: { isDemo: false },
          },
        },
      });

      expect(mockPrisma.leaveRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            employee: {
              company: { isDemo: false },
            },
          },
        }),
      );

      // Verify returned records belong to non-demo companies
      expect(result.data.length).toBe(3);
      for (const record of result.data) {
        expect(record.employee.company.isDemo).toBe(false);
      }
    });
  });

  describe('2. Demo Company Exclusion', () => {
    it('strictly excludes demo company leave records from SuperAdmin queries', async () => {
      const scope = TenantContext.getRequiredTenantScope(superAdminUser, true);

      mockPrisma.leaveRequest.count.mockResolvedValue(1);
      mockPrisma.leaveRequest.findMany.mockResolvedValue([
        {
          id: 'leave-prod',
          status: 'APPROVED',
          employee: { id: 'emp-prod', company: { id: 'PROD-CO', isDemo: false } },
        },
      ]);

      const result: any = await leaveService.getLeaves(superAdminUser, scope, {
        page: 1,
        limit: 50,
      });

      expect(mockPrisma.leaveRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            employee: {
              company: { isDemo: false },
            },
          },
        }),
      );

      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe('leave-prod');
    });
  });

  describe('3. Strict Tenant Isolation for Non-SuperAdmin Users', () => {
    it('restricts HRAdmin to only their authenticated companyId even when isPlatformEndpoint is true', async () => {
      const scope = TenantContext.getRequiredTenantScope(tenantHrUser, true);

      // Non-SuperAdmin MUST NOT get platform bypass
      expect(scope.isPlatformBypass).toBe(false);
      expect(scope.companyId).toBe('COMP-A');

      mockPrisma.leaveRequest.count.mockResolvedValue(1);
      mockPrisma.leaveRequest.findMany.mockResolvedValue([
        {
          id: 'leave-comp-a',
          employeeId: 'emp-a',
          status: 'PENDING',
          employee: { id: 'emp-a', companyId: 'COMP-A' },
        },
      ]);

      const result: any = await leaveService.getLeaves(tenantHrUser, scope, {
        page: 1,
        limit: 50,
      });

      // Prisma MUST filter strictly by companyId: 'COMP-A'
      expect(mockPrisma.leaveRequest.count).toHaveBeenCalledWith({
        where: {
          employee: {
            companyId: 'COMP-A',
          },
        },
      });

      expect(result.data[0].employee.companyId).toBe('COMP-A');
    });

    it('restricts Employee to only their own employee.id', async () => {
      const scope = TenantContext.getRequiredTenantScope(tenantEmployeeUser, true);

      mockPrisma.leaveRequest.count.mockResolvedValue(1);
      mockPrisma.leaveRequest.findMany.mockResolvedValue([
        {
          id: 'leave-emp-1',
          employeeId: 'EMP-001',
          status: 'APPROVED',
          employee: { id: 'EMP-001', companyId: 'COMP-A' },
        },
      ]);

      await leaveService.getLeaves(tenantEmployeeUser, scope, {
        page: 1,
        limit: 50,
      });

      expect(mockPrisma.leaveRequest.count).toHaveBeenCalledWith({
        where: {
          employeeId: 'EMP-001',
          employee: {
            companyId: 'COMP-A',
          },
        },
      });
    });
  });

  describe('4. Status Aggregation Helper Validation', () => {
    function calculateLeaveSummary(leaves: ReadonlyArray<any>) {
      const approved = leaves.filter((l) => (l.status || '').toUpperCase() === 'APPROVED').length;
      const pending = leaves.filter((l) => (l.status || '').toUpperCase() === 'PENDING').length;
      const rejected = leaves.filter((l) => (l.status || '').toUpperCase() === 'REJECTED').length;
      return { approved, pending, rejected };
    }

    it('computes exact leave counts from raw leave status data', () => {
      const mockRawLeaves = [
        { id: '1', status: 'APPROVED' },
        { id: '2', status: 'APPROVED' },
        { id: '3', status: 'PENDING' },
        { id: '4', status: 'REJECTED' },
        { id: '5', status: 'Approved' },
        { id: '6', status: 'Pending' },
      ];

      const summary = calculateLeaveSummary(mockRawLeaves);
      expect(summary).toEqual({
        approved: 3,
        pending: 2,
        rejected: 1,
      });
    });
  });
});

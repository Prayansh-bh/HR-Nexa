import { TenantGuard } from './tenant.guard';
import { TenantContextService } from './tenant-context.service';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Role } from '../../modules/auth/role.enum';

describe('TenantGuard', () => {
  let guard: TenantGuard;
  let tenantContextService: TenantContextService;

  beforeEach(() => {
    tenantContextService = new TenantContextService();
    guard = new TenantGuard(tenantContextService);
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  it('should allow request if user is SuperAdmin', () => {
    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => ({
          user: { role: Role.SuperAdmin, companyId: 'COMPANY_A' },
        }),
      }),
    } as ExecutionContext;

    expect(guard.canActivate(mockContext)).toBe(true);
  });

  it('should allow request if companyId matches', () => {
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

  it('should throw ForbiddenException if companyId does not match', () => {
    TenantContextService.runTenant('COMPANY_B', () => {
      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            user: { role: Role.Employee, companyId: 'COMPANY_A' },
          }),
        }),
      } as ExecutionContext;

      expect(() => guard.canActivate(mockContext)).toThrow(ForbiddenException);
    });
  });
});

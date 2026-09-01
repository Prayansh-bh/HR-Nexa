import { Test, TestingModule } from '@nestjs/testing';
import { PermissionsGuard } from './permissions.guard';
import { Reflector } from '@nestjs/core';
import { RbacService } from './services/rbac.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';

describe('PermissionsGuard', () => {
  let guard: PermissionsGuard;

  const mockReflector = {
    getAllAndOverride: jest.fn(),
  };

  const mockRbacService = {};

  const mockPrismaService = {
    permission: {
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
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    PermissionsGuard.clearCache();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PermissionsGuard,
        { provide: Reflector, useValue: mockReflector },
        { provide: RbacService, useValue: mockRbacService },
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    guard = module.get<PermissionsGuard>(PermissionsGuard);
  });

  const createMockContext = (user: any): ExecutionContext => {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          user,
        }),
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as any;
  };

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  it('should allow access if no permissions are required', async () => {
    mockReflector.getAllAndOverride.mockReturnValue([]);
    const context = createMockContext({ role: 'Employee' });

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
  });

  it('should allow SuperAdmin access unconditionally', async () => {
    mockReflector.getAllAndOverride.mockReturnValue(['payroll:process:view']);
    const context = createMockContext({ role: 'SuperAdmin' });

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
  });

  it('should throw ForbiddenException if user has no role or is unauthenticated', async () => {
    mockReflector.getAllAndOverride.mockReturnValue(['payroll:process:view']);
    const context = createMockContext(null);

    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
  });

  it('should throw ForbiddenException if user role lacks the required permission', async () => {
    mockReflector.getAllAndOverride.mockReturnValue(['payroll:process:view']);
    const context = createMockContext({
      role: 'Employee',
      permissions: ['leaves:read'],
    });

    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
  });

  it('should allow access if role has permission and plan features are enabled', async () => {
    mockReflector.getAllAndOverride.mockReturnValue(['payroll:process:view']);
    const context = createMockContext({
      role: 'HRAdmin',
      permissions: ['payroll:process:view'],
      subscription: {
        company: 'Acme Corp',
        plan: 'PREMIUM',
        status: 'Active',
      },
    });

    mockPrismaService.permission.findUnique.mockResolvedValue({
      feature: { key: 'PAYROLL_BASIC' },
    });
    mockPrismaService.companyPlanAssignment.findUnique.mockResolvedValue(null);
    mockPrismaService.saaSPlanNew.findUnique.mockResolvedValue({
      versions: [{ id: 'version-prem-1' }],
    });
    mockPrismaService.planVersion.findUnique.mockResolvedValue({
      features: [{ feature: { key: 'PAYROLL_BASIC' } }],
    });

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
  });

  it('should block access and throw ForbiddenException if role has permission but plan feature is disabled', async () => {
    mockReflector.getAllAndOverride.mockReturnValue(['payroll:process:view']);
    const context = createMockContext({
      role: 'HRAdmin',
      permissions: ['payroll:process:view'],
      subscription: {
        company: 'Acme Corp',
        plan: 'BASIC',
        status: 'Active',
      },
    });

    mockPrismaService.permission.findUnique.mockResolvedValue({
      feature: { key: 'PAYROLL_BASIC' },
    });
    mockPrismaService.companyPlanAssignment.findUnique.mockResolvedValue(null);
    mockPrismaService.saaSPlanNew.findUnique.mockResolvedValue({
      versions: [{ id: 'version-basic-1' }],
    });
    // Feature key is not included in the plan features list:
    mockPrismaService.planVersion.findUnique.mockResolvedValue({
      features: [{ feature: { key: 'CORE_EMPLOYEE' } }],
    });

    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
  });
});

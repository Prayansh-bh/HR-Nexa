import { RolesGuard } from '../roles.guard';
import { PermissionsGuard } from '../permissions.guard';
import { Reflector } from '@nestjs/core';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Role } from '../role.enum';

describe('PHASE 2H ADVERSARIAL: RBAC & Permission Bypass Attacks', () => {
  let rolesGuard: RolesGuard;
  let permissionsGuard: PermissionsGuard;
  let reflector: Reflector;
  const mockPrisma = {
    permission: { findMany: jest.fn() },
    companyPlanAssignment: { findUnique: jest.fn() },
    planVersion: { findUnique: jest.fn() },
  } as any;

  beforeEach(() => {
    reflector = new Reflector();
    rolesGuard = new RolesGuard(reflector);
    permissionsGuard = new PermissionsGuard(reflector, mockPrisma);
  });

  function createMockContext(user: any, requiredRoles?: Role[], requiredPermissions?: string[]): ExecutionContext {
    const handler = () => {};
    const classRef = class {};

    jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key: string) => {
      if (key === 'roles') return requiredRoles;
      if (key === 'permissions' || key === 'require_permissions') return requiredPermissions;
      return undefined;
    });

    return {
      switchToHttp: () => ({
        getRequest: () => ({
          user,
          headers: {},
        }),
        getResponse: () => ({}),
      }),
      getHandler: () => handler,
      getClass: () => classRef,
    } as unknown as ExecutionContext;
  }

  describe('Attack 1: Viewer Attempting Admin / Mutation Actions', () => {
    it('MUST REJECT Viewer attempting HR Admin endpoint (RolesGuard)', () => {
      const viewerUser = { id: 'usr-view', role: Role.Viewer, permissions: [] };
      const ctx = createMockContext(viewerUser, [Role.HRAdmin, Role.SuperAdmin]);
      expect(rolesGuard.canActivate(ctx)).toBe(false);
    });

    it('MUST THROW ForbiddenException when Viewer attempts write permissions (PermissionsGuard)', async () => {
      const viewerUser = { id: 'usr-view', role: Role.Viewer, permissions: ['employees.view'] };
      const ctx = createMockContext(viewerUser, undefined, ['employees.create']);
      await expect(permissionsGuard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('Attack 2: Employee Attempting Manager Approval Endpoints', () => {
    it('MUST REJECT Employee calling Manager approval role endpoint (RolesGuard)', () => {
      const employeeUser = { id: 'usr-emp', role: Role.Employee, permissions: [] };
      const ctx = createMockContext(employeeUser, [Role.Manager, Role.HRAdmin]);
      expect(rolesGuard.canActivate(ctx)).toBe(false);
    });

    it('MUST THROW ForbiddenException when Employee attempts leave.approve permission (PermissionsGuard)', async () => {
      const employeeUser = { id: 'usr-emp', role: Role.Employee, permissions: ['leave.view', 'leave.create'] };
      const ctx = createMockContext(employeeUser, undefined, ['leave.approve']);
      await expect(permissionsGuard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('Attack 3: Accountant Attempting Employee Administrative Actions', () => {
    it('MUST THROW ForbiddenException when Accountant attempts employee deletion (PermissionsGuard)', async () => {
      const accountantUser = { id: 'usr-acc', role: Role.Accountant, permissions: ['payroll.view', 'payroll.process'] };
      const ctx = createMockContext(accountantUser, undefined, ['employees.delete']);
      await expect(permissionsGuard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('Attack 4: Missing or Unauthenticated User Context', () => {
    it('MUST REJECT null or undefined user in RolesGuard', () => {
      const ctx = createMockContext(null, [Role.Employee]);
      expect(rolesGuard.canActivate(ctx)).toBe(false);
    });

    it('MUST THROW ForbiddenException for unauthenticated user in PermissionsGuard', async () => {
      const ctx = createMockContext(null, undefined, ['employees.view']);
      await expect(permissionsGuard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('Attack 5: Direct HTTP Header or Payload Role Tampering', () => {
    it('MUST NOT allow fabricated role strings without matching permissions', async () => {
      const spoofedUser = { id: 'usr-spoofed', role: 'CustomHackerRole', permissions: [] };
      const ctx = createMockContext(spoofedUser, undefined, ['payroll.manage']);
      await expect(permissionsGuard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
    });
  });
});

import { PermissionResolver } from './permission-resolver.service';
import { PrismaService } from '../../../prisma/prisma.service';

jest.mock('../../../common/tenant/tenant-validation.util', () => ({
  getEffectivePermissions: jest.fn(
    async (
      _prisma: unknown,
      _role: string,
      rolePermissions: string[],
    ) => rolePermissions,
  ),
}));

describe('PermissionResolver — Tenant Isolation Regression', () => {
  let resolver: PermissionResolver;
  let mockPrisma: {
    role: {
      findFirst: jest.Mock;
    };
  };

  beforeEach(() => {
    mockPrisma = {
      role: {
        findFirst: jest.fn(),
      },
    };

    resolver = new PermissionResolver(mockPrisma as unknown as PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('must reject a roleId that belongs to another tenant', async () => {
    const foreignRole = {
      id: 'role-company-a',
      name: 'HRAdmin',
      companyId: 'company-a',
      permissions: JSON.stringify([
        'employees:list:view',
        'payroll:process:run',
        'settings:roles:edit',
      ]),
    };

    mockPrisma.role.findFirst.mockImplementation(async ({ where }: any) => {
      if (
        where.id === 'role-company-a' &&
        where.companyId === 'company-b'
      ) {
        return null;
      }

      if (
        where.companyId === 'company-b' &&
        where.name === 'HRAdmin'
      ) {
        return null;
      }

      return foreignRole;
    });

    const user = {
      id: 'user-company-b',
      role: 'HRAdmin',
      roleId: 'role-company-a',
      companyId: 'company-b',
      subscription: {
        company: 'Company B',
        plan: 'PREMIUM',
        status: 'Active',
      },
    };

    const permissions = await resolver.resolve(user);

    expect(permissions).toEqual([]);

    expect(mockPrisma.role.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'role-company-a',
        companyId: 'company-b',
      },
    });

    expect(permissions).not.toContain('payroll:process:run');
    expect(permissions).not.toContain('settings:roles:edit');
  });

  it('must fail closed when no tenant role exists and must not use a global role', async () => {
    const globalRole = {
      id: 'global-hradmin',
      name: 'HRAdmin',
      companyId: null,
      isSystem: true,
      permissions: JSON.stringify([
        'employees:list:view',
        'payroll:process:run',
        'settings:roles:edit',
      ]),
    };

    mockPrisma.role.findFirst.mockImplementation(async ({ where }: any) => {
      if (
        where.companyId === 'company-b' &&
        where.name === 'HRAdmin'
      ) {
        return null;
      }

      if (
        where.name === 'HRAdmin' &&
        !Object.prototype.hasOwnProperty.call(where, 'companyId')
      ) {
        return globalRole;
      }

      return null;
    });

    const user = {
      id: 'user-company-b',
      role: 'HRAdmin',
      companyId: 'company-b',
      subscription: {
        company: 'Company B',
        plan: 'PREMIUM',
        status: 'Active',
      },
    };

    const permissions = await resolver.resolve(user);

    expect(permissions).toEqual([]);

    expect(mockPrisma.role.findFirst).toHaveBeenCalledWith({
      where: {
        companyId: 'company-b',
        name: 'HRAdmin',
      },
    });

    expect(mockPrisma.role.findFirst).not.toHaveBeenCalledWith({
      where: {
        name: 'HRAdmin',
        isSystem: true,
        companyId: null,
      },
    });
  });
});

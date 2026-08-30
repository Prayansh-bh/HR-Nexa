import { Test, TestingModule } from '@nestjs/testing';
import { RoleProvisioningService } from './role-provisioning.service';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  DEFAULT_COMPANY_ROLES,
  CANONICAL_ROLE_PERMISSIONS,
} from '../constants/canonical-permissions';

describe('RoleProvisioningService (Unit & Invariant Specs)', () => {
  let service: RoleProvisioningService;
  let mockPrisma: any;
  let inMemoryRoles: any[];

  beforeEach(async () => {
    inMemoryRoles = [];

    mockPrisma = {
      role: {
        findMany: jest.fn().mockImplementation((args: any) => {
          const companyId = args?.where?.companyId;
          return inMemoryRoles.filter((r) => r.companyId === companyId);
        }),
        findFirst: jest.fn().mockImplementation((args: any) => {
          const { name, companyId } = args?.where || {};
          return inMemoryRoles.find(
            (r) => r.name === name && r.companyId === companyId,
          ) || null;
        }),
        upsert: jest.fn().mockImplementation((args: any) => {
          const { name, companyId } = args?.where?.name_companyId || {};
          const existing = inMemoryRoles.find(
            (r) => r.name === name && r.companyId === companyId,
          );
          if (existing) {
            return existing;
          }
          const newRole = {
            id: `ROLE-${name}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            name: args.create.name,
            description: args.create.description,
            isSystem: args.create.isSystem,
            permissions: args.create.permissions,
            companyId: args.create.companyId,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          inMemoryRoles.push(newRole);
          return newRole;
        }),
        create: jest.fn().mockImplementation((args: any) => {
          const newRole = {
            id: `ROLE-${args.data.name}-${Date.now()}`,
            ...args.data,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          inMemoryRoles.push(newRole);
          return newRole;
        }),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RoleProvisioningService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<RoleProvisioningService>(RoleProvisioningService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('Test 1 — Complete tenant: does not duplicate any roles if all 7 defaults exist', async () => {
    const companyId = 'COMP_COMPLETE_1';
    for (const roleName of DEFAULT_COMPANY_ROLES) {
      inMemoryRoles.push({
        id: `EXISTING-${roleName}`,
        name: roleName,
        description: `${roleName} existing`,
        isSystem: true,
        permissions: JSON.stringify(['custom:permission']),
        companyId,
      });
    }

    const result = await service.ensureDefaultRoles(companyId);

    expect(Object.keys(result)).toHaveLength(7);
    expect(mockPrisma.role.upsert).not.toHaveBeenCalled();
    expect(inMemoryRoles.filter((r) => r.companyId === companyId)).toHaveLength(7);
    expect(result['HRAdmin'].id).toBe('EXISTING-HRAdmin');
  });

  it('Test 2 — Zero-role tenant: provisions all 7 default roles with canonical permissions', async () => {
    const companyId = 'COMP_ZERO_1';

    const result = await service.ensureDefaultRoles(companyId);

    expect(Object.keys(result)).toHaveLength(7);
    for (const roleName of DEFAULT_COMPANY_ROLES) {
      expect(result[roleName]).toBeDefined();
      expect(result[roleName].companyId).toBe(companyId);
      expect(result[roleName].isSystem).toBe(true);

      const parsedPerms = JSON.parse(result[roleName].permissions);
      expect(parsedPerms).toEqual(CANONICAL_ROLE_PERMISSIONS[roleName]);
    }
  });

  it('Test 3 — Partial tenant: creates only missing defaults and preserves existing role IDs', async () => {
    const companyId = 'COMP_PARTIAL_1';
    inMemoryRoles.push(
      {
        id: 'EXISTING-HRAdmin',
        name: 'HRAdmin',
        description: 'Existing HRAdmin',
        isSystem: true,
        permissions: JSON.stringify(['custom:hr:perm']),
        companyId,
      },
      {
        id: 'EXISTING-Employee',
        name: 'Employee',
        description: 'Existing Employee',
        isSystem: true,
        permissions: JSON.stringify(['custom:emp:perm']),
        companyId,
      },
    );

    const result = await service.ensureDefaultRoles(companyId);

    expect(Object.keys(result)).toHaveLength(7);
    expect(result['HRAdmin'].id).toBe('EXISTING-HRAdmin');
    expect(JSON.parse(result['HRAdmin'].permissions)).toEqual(['custom:hr:perm']);
    expect(result['Employee'].id).toBe('EXISTING-Employee');

    // 5 missing roles should have been provisioned
    expect(mockPrisma.role.upsert).toHaveBeenCalledTimes(5);
    expect(result['Manager']).toBeDefined();
    expect(result['Accountant']).toBeDefined();
    expect(result['Recruiter']).toBeDefined();
    expect(result['Viewer']).toBeDefined();
    expect(result['HR Staff']).toBeDefined();
  });

  it('Test 4 — Custom roles: preserves all existing custom roles untouched', async () => {
    const companyId = 'COMP_CUSTOM_1';
    inMemoryRoles.push({
      id: 'CUSTOM-ROLE-123',
      name: 'VP of Engineering',
      description: 'Custom VP role',
      isSystem: false,
      permissions: JSON.stringify(['custom:engineering:manage']),
      companyId,
    });

    const result = await service.ensureDefaultRoles(companyId);

    expect(result['VP of Engineering']).toBeDefined();
    expect(result['VP of Engineering'].id).toBe('CUSTOM-ROLE-123');
    expect(result['HRAdmin']).toBeDefined();
    expect(inMemoryRoles.filter((r) => r.companyId === companyId)).toHaveLength(8); // 1 custom + 7 defaults
  });

  it('Test 5 — Role permissions: newly created default roles receive canonical initial baseline', async () => {
    const companyId = 'COMP_PERMS_1';
    const result = await service.ensureDefaultRoles(companyId);

    const hrPerms = JSON.parse(result['HRAdmin'].permissions);
    expect(hrPerms).toEqual(CANONICAL_ROLE_PERMISSIONS['HRAdmin']);

    const mgrPerms = JSON.parse(result['Manager'].permissions);
    expect(mgrPerms).toEqual(CANONICAL_ROLE_PERMISSIONS['Manager']);

    const accPerms = JSON.parse(result['Accountant'].permissions);
    expect(accPerms).toEqual(CANONICAL_ROLE_PERMISSIONS['Accountant']);
  });

  it('Test 6 — Idempotency: repeated provisioning executions produce no extra roles', async () => {
    const companyId = 'COMP_IDEMPOTENT_1';

    const firstRun = await service.ensureDefaultRoles(companyId);
    const secondRun = await service.ensureDefaultRoles(companyId);

    expect(Object.keys(firstRun)).toHaveLength(7);
    expect(Object.keys(secondRun)).toHaveLength(7);
    expect(inMemoryRoles.filter((r) => r.companyId === companyId)).toHaveLength(7);

    for (const roleName of DEFAULT_COMPANY_ROLES) {
      expect(firstRun[roleName].id).toBe(secondRun[roleName].id);
    }
  });

  it('Test 7 — Concurrency safe: handles upsert collision gracefully', async () => {
    const companyId = 'COMP_CONCURRENT_1';

    // Simulate two concurrent ensureDefaultRoles executions
    const [runA, runB] = await Promise.all([
      service.ensureDefaultRoles(companyId),
      service.ensureDefaultRoles(companyId),
    ]);

    expect(Object.keys(runA)).toHaveLength(7);
    expect(Object.keys(runB)).toHaveLength(7);
    expect(inMemoryRoles.filter((r) => r.companyId === companyId)).toHaveLength(7);
  });

  it('Test 8 — Tenant isolation: provisioning Tenant A does not alter Tenant B roles', async () => {
    const tenantA = 'TENANT_A';
    const tenantB = 'TENANT_B';

    await service.ensureDefaultRoles(tenantA);

    expect(inMemoryRoles.filter((r) => r.companyId === tenantA)).toHaveLength(7);
    expect(inMemoryRoles.filter((r) => r.companyId === tenantB)).toHaveLength(0);
  });

  it('Test 9 — Global system roles: companyId=null roles remain completely untouched', async () => {
    inMemoryRoles.push({
      id: 'GLOBAL-SUPERADMIN',
      name: 'SuperAdmin',
      description: 'Platform Super Admin',
      isSystem: true,
      permissions: JSON.stringify(['*:*']),
      companyId: null,
    });

    const tenantA = 'TENANT_A';
    await service.ensureDefaultRoles(tenantA);

    const globalRole = inMemoryRoles.find((r) => r.companyId === null);
    expect(globalRole).toBeDefined();
    expect(globalRole.id).toBe('GLOBAL-SUPERADMIN');
    expect(globalRole.companyId).toBeNull();
  });

  it('Test 10 — Broken test company repair: correctly repairs TEST_COMPANY_PURGE_B_msw4xib6', async () => {
    const targetCompanyId = 'TEST_COMPANY_PURGE_B_msw4xib6';

    expect(inMemoryRoles.filter((r) => r.companyId === targetCompanyId)).toHaveLength(0);

    const result = await service.ensureDefaultRoles(targetCompanyId);

    expect(Object.keys(result)).toHaveLength(7);
    expect(inMemoryRoles.filter((r) => r.companyId === targetCompanyId)).toHaveLength(7);
    expect(result['HRAdmin']).toBeDefined();
    expect(result['Manager']).toBeDefined();
    expect(result['Accountant']).toBeDefined();
    expect(result['Recruiter']).toBeDefined();
    expect(result['Employee']).toBeDefined();
    expect(result['Viewer']).toBeDefined();
    expect(result['HR Staff']).toBeDefined();
  });

  it('Test 11 — Transaction participation: uses provided transaction client', async () => {
    const companyId = 'COMP_TX_1';
    const mockTx: any = {
      role: {
        findMany: jest.fn().mockResolvedValue([]),
        upsert: jest.fn().mockImplementation((args: any) => ({
          id: `TX-ROLE-${args.create.name}`,
          ...args.create,
        })),
        findFirst: jest.fn(),
      },
    };

    const result = await service.ensureDefaultRoles(companyId, mockTx);

    expect(mockTx.role.findMany).toHaveBeenCalled();
    expect(mockTx.role.upsert).toHaveBeenCalledTimes(7);
    expect(mockPrisma.role.upsert).not.toHaveBeenCalled();
    expect(result['HRAdmin'].id).toBe('TX-ROLE-HRAdmin');
  });
});

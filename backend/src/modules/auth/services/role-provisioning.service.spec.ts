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
        update: jest.fn().mockImplementation((args: any) => {
          const id = args?.where?.id;
          const target = inMemoryRoles.find((r) => r.id === id);
          if (!target) {
            throw new Error(`Record to update not found (id: ${id})`);
          }
          Object.assign(target, args.data, { updatedAt: new Date() });
          return { ...target };
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

  it('Test 1 — Complete tenant: does not duplicate any roles if all 7 defaults exist and reconciles missing canonical perms', async () => {
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
    const hrPerms = JSON.parse(result['HRAdmin'].permissions);
    expect(hrPerms).toContain('custom:permission');
    expect(hrPerms).toEqual(expect.arrayContaining(CANONICAL_ROLE_PERMISSIONS['HRAdmin']));
    expect(mockPrisma.role.update).toHaveBeenCalledTimes(7);
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

  it('Test 3 — Partial tenant: creates only missing defaults, preserves existing role IDs, and reconciles existing system roles', async () => {
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
    const hrPerms = JSON.parse(result['HRAdmin'].permissions);
    expect(hrPerms).toContain('custom:hr:perm');
    expect(hrPerms).toEqual(expect.arrayContaining(CANONICAL_ROLE_PERMISSIONS['HRAdmin']));

    expect(result['Employee'].id).toBe('EXISTING-Employee');
    const empPerms = JSON.parse(result['Employee'].permissions);
    expect(empPerms).toContain('custom:emp:perm');
    expect(empPerms).toEqual(expect.arrayContaining(CANONICAL_ROLE_PERMISSIONS['Employee']));

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
        update: jest.fn().mockImplementation((args: any) => ({
          id: args?.where?.id,
          ...args.data,
          updatedAt: new Date(),
        })),
      },
    };

    const result = await service.ensureDefaultRoles(companyId, mockTx);

    expect(mockTx.role.findMany).toHaveBeenCalled();
    expect(mockTx.role.upsert).toHaveBeenCalledTimes(7);
    expect(mockPrisma.role.upsert).not.toHaveBeenCalled();
    expect(result['HRAdmin'].id).toBe('TX-ROLE-HRAdmin');
  });

  // ==========================================
  // REGRESSION TEST SUITE (Tests A through K)
  // ==========================================

  it('TEST A — Existing complete system roles with custom/existing permissions remain intact except for missing canonical permissions', async () => {
    const companyId = 'COMP_REGR_A';
    inMemoryRoles.push({
      id: 'EXISTING-ROLE-MGR',
      name: 'Manager',
      description: 'Custom Manager Role',
      isSystem: true,
      permissions: JSON.stringify(['custom:manager:analytics']),
      companyId,
    });

    const result = await service.ensureDefaultRoles(companyId);
    const mgr = result['Manager'];

    expect(mgr).toBeDefined();
    expect(mgr.id).toBe('EXISTING-ROLE-MGR');
    expect(mgr.name).toBe('Manager');
    expect(mgr.companyId).toBe(companyId);
    const perms = JSON.parse(mgr.permissions);
    expect(perms).toContain('custom:manager:analytics');
    expect(perms).toEqual(expect.arrayContaining(CANONICAL_ROLE_PERMISSIONS['Manager']));
  });

  it('TEST B — Missing canonical permissions are added', async () => {
    const companyId = 'COMP_REGR_B';
    const initialPerms = ['employees:list:view', 'chatbox:access'];
    inMemoryRoles.push({
      id: 'EXISTING-ROLE-HR',
      name: 'HRAdmin',
      description: 'Initial HRAdmin',
      isSystem: true,
      permissions: JSON.stringify(initialPerms),
      companyId,
    });

    const result = await service.ensureDefaultRoles(companyId);
    const hr = result['HRAdmin'];
    const perms: string[] = JSON.parse(hr.permissions);

    for (const canonicalPerm of CANONICAL_ROLE_PERMISSIONS['HRAdmin']) {
      expect(perms).toContain(canonicalPerm);
    }
  });

  it('TEST C — Existing permissions are NOT removed', async () => {
    const companyId = 'COMP_REGR_C';
    const customUniquePerm = 'enterprise:custom:permission:do_not_remove';
    inMemoryRoles.push({
      id: 'EXISTING-ROLE-EMP',
      name: 'Employee',
      description: 'Employee Role',
      isSystem: true,
      permissions: JSON.stringify([customUniquePerm]),
      companyId,
    });

    const result = await service.ensureDefaultRoles(companyId);
    const emp = result['Employee'];
    const perms: string[] = JSON.parse(emp.permissions);

    expect(perms).toContain(customUniquePerm);
  });

  it('TEST D — No duplicate permissions are created', async () => {
    const companyId = 'COMP_REGR_D';
    // Provide an existing system role that already contains several canonical permissions
    const partialCanonical = CANONICAL_ROLE_PERMISSIONS['Accountant'].slice(0, 5);
    inMemoryRoles.push({
      id: 'EXISTING-ROLE-ACC',
      name: 'Accountant',
      description: 'Accountant Role',
      isSystem: true,
      permissions: JSON.stringify(partialCanonical),
      companyId,
    });

    const result = await service.ensureDefaultRoles(companyId);
    const acc = result['Accountant'];
    const perms: string[] = JSON.parse(acc.permissions);

    const uniqueSet = new Set(perms);
    expect(perms.length).toBe(uniqueSet.size);
  });

  it('TEST E — Existing role ID remains unchanged', async () => {
    const companyId = 'COMP_REGR_E';
    const fixedId = 'IMMUTABLE-ROLE-ID-999';
    inMemoryRoles.push({
      id: fixedId,
      name: 'Recruiter',
      description: 'Existing Recruiter',
      isSystem: true,
      permissions: JSON.stringify([]),
      companyId,
    });

    const result = await service.ensureDefaultRoles(companyId);
    expect(result['Recruiter'].id).toBe(fixedId);
  });

  it('TEST F — Custom roles are completely untouched', async () => {
    const companyId = 'COMP_REGR_F';
    const customRoleId = 'CUSTOM-AUDITOR-ROLE-1';
    const customPerms = ['audit:finance:special'];
    inMemoryRoles.push({
      id: customRoleId,
      name: 'External Auditor',
      description: 'Auditor Custom Role',
      isSystem: false,
      permissions: JSON.stringify(customPerms),
      companyId,
    });

    const result = await service.ensureDefaultRoles(companyId);

    const auditor = inMemoryRoles.find((r) => r.id === customRoleId);
    expect(auditor).toBeDefined();
    expect(auditor.permissions).toBe(JSON.stringify(customPerms));
    expect(result['External Auditor']).toBeDefined();
    expect(result['External Auditor'].id).toBe(customRoleId);
  });

  it('TEST G — Global companyId=null roles are untouched', async () => {
    const globalId = 'PLATFORM-GLOBAL-SUPERADMIN';
    const globalPerms = ['platform:superadmin:all'];
    inMemoryRoles.push({
      id: globalId,
      name: 'PlatformAdmin',
      description: 'Global Admin',
      isSystem: true,
      permissions: JSON.stringify(globalPerms),
      companyId: null,
    });

    await service.ensureDefaultRoles('TENANT_COMP_G');

    const globalRole = inMemoryRoles.find((r) => r.id === globalId);
    expect(globalRole).toBeDefined();
    expect(globalRole.permissions).toBe(JSON.stringify(globalPerms));
    expect(globalRole.companyId).toBeNull();
  });

  it('TEST H — Tenant A provisioning cannot modify Tenant B', async () => {
    const tenantA = 'TENANT_REGR_A';
    const tenantB = 'TENANT_REGR_B';

    inMemoryRoles.push({
      id: 'TENANT-B-ROLE-1',
      name: 'HRAdmin',
      description: 'Tenant B HRAdmin',
      isSystem: true,
      permissions: JSON.stringify(['tenant_b:isolated:perm']),
      companyId: tenantB,
    });

    await service.ensureDefaultRoles(tenantA);

    const tenantBRoles = inMemoryRoles.filter((r) => r.companyId === tenantB);
    expect(tenantBRoles).toHaveLength(1);
    expect(tenantBRoles[0].id).toBe('TENANT-B-ROLE-1');
    expect(tenantBRoles[0].permissions).toBe(JSON.stringify(['tenant_b:isolated:perm']));

    const tenantARoles = inMemoryRoles.filter((r) => r.companyId === tenantA);
    expect(tenantARoles).toHaveLength(7);
  });

  it('TEST I — Running ensureDefaultRoles twice does not perform unnecessary permission updates the second time', async () => {
    const companyId = 'COMP_REGR_I';
    inMemoryRoles.push({
      id: 'EXISTING-ROLE-MGR-I',
      name: 'Manager',
      description: 'Manager',
      isSystem: true,
      permissions: JSON.stringify(['employees:list:view']),
      companyId,
    });

    // First run provisions missing roles and reconciles Manager
    const firstResult = await service.ensureDefaultRoles(companyId);
    expect(Object.keys(firstResult)).toHaveLength(7);
    expect(mockPrisma.role.update).toHaveBeenCalledTimes(1);
    expect(mockPrisma.role.upsert).toHaveBeenCalledTimes(6);

    // Reset mock call history
    mockPrisma.role.update.mockClear();
    mockPrisma.role.upsert.mockClear();

    // Second run: all 7 roles exist with full canonical permissions
    const secondResult = await service.ensureDefaultRoles(companyId);

    expect(Object.keys(secondResult)).toHaveLength(7);
    expect(mockPrisma.role.update).not.toHaveBeenCalled();
    expect(mockPrisma.role.upsert).not.toHaveBeenCalled();
  });

  it('TEST J — Malformed permissions JSON does not crash the provisioning flow; behavior is safe and consistent', async () => {
    const companyId = 'COMP_REGR_J';
    inMemoryRoles.push({
      id: 'CORRUPTED-ROLE-1',
      name: 'Viewer',
      description: 'Corrupted permissions JSON',
      isSystem: true,
      permissions: '{invalid json string',
      companyId,
    });

    const result = await service.ensureDefaultRoles(companyId);
    const viewer = result['Viewer'];

    expect(viewer).toBeDefined();
    expect(viewer.id).toBe('CORRUPTED-ROLE-1');
    const perms = JSON.parse(viewer.permissions);
    expect(perms).toEqual(CANONICAL_ROLE_PERMISSIONS['Viewer']);
  });

  it('TEST K — Transaction client uses the transaction role.update when reconciliation is required', async () => {
    const companyId = 'COMP_REGR_K';
    inMemoryRoles.push({
      id: 'TX-EXISTING-HR',
      name: 'HRAdmin',
      description: 'Existing HRAdmin needing reconciliation',
      isSystem: true,
      permissions: JSON.stringify(['custom:tx:perm']),
      companyId,
    });

    const mockTx: any = {
      role: {
        findMany: jest.fn().mockImplementation((args: any) => {
          const cId = args?.where?.companyId;
          return inMemoryRoles.filter((r) => r.companyId === cId);
        }),
        upsert: jest.fn().mockImplementation((args: any) => {
          const newRole = {
            id: `TX-ROLE-${args.create.name}`,
            ...args.create,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          inMemoryRoles.push(newRole);
          return newRole;
        }),
        findFirst: jest.fn(),
        update: jest.fn().mockImplementation((args: any) => {
          const id = args?.where?.id;
          const target = inMemoryRoles.find((r) => r.id === id);
          if (!target) {
            throw new Error(`Record not found: ${id}`);
          }
          Object.assign(target, args.data, { updatedAt: new Date() });
          return { ...target };
        }),
      },
    };

    const result = await service.ensureDefaultRoles(companyId, mockTx);

    expect(mockTx.role.findMany).toHaveBeenCalled();
    expect(mockTx.role.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'TX-EXISTING-HR' },
      }),
    );
    expect(mockPrisma.role.update).not.toHaveBeenCalled();
    expect(result['HRAdmin'].id).toBe('TX-EXISTING-HR');
    const hrPerms = JSON.parse(result['HRAdmin'].permissions);
    expect(hrPerms).toContain('custom:tx:perm');
    expect(hrPerms).toEqual(expect.arrayContaining(CANONICAL_ROLE_PERMISSIONS['HRAdmin']));
  });
});


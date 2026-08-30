import { Test, TestingModule } from '@nestjs/testing';
import { RolesController } from './roles.controller';
import { RbacService } from '../services/rbac.service';
import { RoleProvisioningService } from '../services/role-provisioning.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { ForbiddenException, BadRequestException } from '@nestjs/common';

describe('RolesController (Unit Specs)', () => {
  let controller: RolesController;
  let mockRbacService: any;
  let mockRoleProvisioningService: any;
  let mockPrisma: any;

  beforeEach(async () => {
    mockRbacService = {
      getRolesForCompany: jest.fn().mockImplementation((companyId: string) => [
        { id: 'ROLE-HRAdmin', name: 'HRAdmin', companyId, isSystem: true },
        { id: 'ROLE-Manager', name: 'Manager', companyId, isSystem: true },
      ]),
      createRole: jest.fn(),
      updateRole: jest.fn(),
      deleteRole: jest.fn(),
    };

    mockRoleProvisioningService = {
      ensureDefaultRoles: jest.fn().mockImplementation((companyId: string) => ({
        HRAdmin: { id: 'ROLE-HRAdmin', name: 'HRAdmin', companyId },
        Manager: { id: 'ROLE-Manager', name: 'Manager', companyId },
        Accountant: { id: 'ROLE-Accountant', name: 'Accountant', companyId },
        Recruiter: { id: 'ROLE-Recruiter', name: 'Recruiter', companyId },
        Employee: { id: 'ROLE-Employee', name: 'Employee', companyId },
        Viewer: { id: 'ROLE-Viewer', name: 'Viewer', companyId },
        'HR Staff': { id: 'ROLE-HRStaff', name: 'HR Staff', companyId },
      })),
    };

    mockPrisma = {
      subscription: {
        findFirst: jest.fn().mockResolvedValue({ id: 'SUB-1', plan: 'ENTERPRISE' }),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({ id: 'LOG-1' }),
      },
      saaSPlanNew: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'PLAN-1',
          versions: [
            {
              features: [{ feature: { key: 'ROLE_MANAGEMENT' }, enabled: true }],
            },
          ],
        }),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [RolesController],
      providers: [
        { provide: RbacService, useValue: mockRbacService },
        { provide: RoleProvisioningService, useValue: mockRoleProvisioningService },
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    controller = module.get<RolesController>(RolesController);
  });

  it('GET /auth/roles-mgmt: returns tenant roles for authenticated HRAdmin', async () => {
    const req: any = {
      user: { id: 'U-1', role: 'HRAdmin', companyId: 'COMP_A' },
    };

    const result = await controller.getRoles(req);

    expect(mockRbacService.getRolesForCompany).toHaveBeenCalledWith('COMP_A');
    expect(result).toHaveLength(2);
  });

  it('GET /auth/roles-mgmt: returns tenant roles when SuperAdmin provides companyId', async () => {
    const req: any = {
      user: { id: 'SUPER-1', role: 'SuperAdmin', companyId: 'PLATFORM' },
    };

    const result = await controller.getRoles(req, 'TARGET_TENANT_X');

    expect(mockRbacService.getRolesForCompany).toHaveBeenCalledWith('TARGET_TENANT_X');
    expect(result).toHaveLength(2);
  });

  it('GET /auth/roles-mgmt: returns platform system roles when SuperAdmin provides NO companyId', async () => {
    const req: any = {
      user: { id: 'SUPER-1', role: 'SuperAdmin', companyId: 'PLATFORM' },
    };

    const result = await controller.getRoles(req, undefined);

    expect(mockRbacService.getRolesForCompany).toHaveBeenCalledWith(null);
    expect(result).toHaveLength(2);
  });

  it('POST /auth/roles-mgmt/bootstrap: HRAdmin bootstraps their own company (server-authoritative)', async () => {
    const req: any = {
      user: { id: 'U-1', role: 'HRAdmin', companyId: 'COMP_A' },
    };

    const result = await controller.bootstrapRoles(req, 'ATTEMPTED_SPOOF_COMP_B');

    // Server-authoritative: HRAdmin company context is taken from req.user.companyId
    expect(mockRoleProvisioningService.ensureDefaultRoles).toHaveBeenCalledWith('COMP_A');
    expect(result).toHaveLength(7);
  });

  it('POST /auth/roles-mgmt/bootstrap: SuperAdmin can bootstrap specific tenant company with audit log', async () => {
    const req: any = {
      user: { id: 'SUPER-1', role: 'SuperAdmin', name: 'Platform Admin' },
    };

    const result = await controller.bootstrapRoles(req, 'TEST_COMPANY_PURGE_B_msw4xib6');

    expect(mockRoleProvisioningService.ensureDefaultRoles).toHaveBeenCalledWith(
      'TEST_COMPANY_PURGE_B_msw4xib6',
    );
    expect(mockPrisma.auditLog.create).toHaveBeenCalled();
    expect(result).toHaveLength(7);
  });

  it('POST /auth/roles-mgmt/bootstrap: throws BadRequestException if SuperAdmin does not specify companyId', async () => {
    const req: any = {
      user: { id: 'SUPER-1', role: 'SuperAdmin' },
    };

    await expect(controller.bootstrapRoles(req, undefined)).rejects.toThrow(
      BadRequestException,
    );
  });
});

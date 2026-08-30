import { Test, TestingModule } from '@nestjs/testing';
import { TaxDeclarationController } from './tax-declaration.controller';
import { TaxDeclarationService } from '../services/tax-declaration.service';
import { CreateTaxDeclarationDto, AuditTaxDeclarationDto } from '../dto/tax-declaration.dto';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { SubscriptionGuard } from '../../auth/subscription.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { PermissionsGuard } from '../../auth/permissions.guard';

describe('Employee Tax Declarations - Integration & Security Specs', () => {
  let controller: TaxDeclarationController;
  let service: TaxDeclarationService;

  const mockTaxDeclarationService = {
    getMyDeclaration: jest.fn(),
    createMyDeclaration: jest.fn(),
    updateMyDeclaration: jest.fn(),
    submitMyDeclaration: jest.fn(),
    findTenantDeclarations: jest.fn(),
    getDeclarationById: jest.fn(),
    auditDeclaration: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TaxDeclarationController],
      providers: [
        { provide: TaxDeclarationService, useValue: mockTaxDeclarationService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(SubscriptionGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(PermissionsGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<TaxDeclarationController>(TaxDeclarationController);
    service = module.get<TaxDeclarationService>(TaxDeclarationService);
  });

  const mockEmployeeUser = {
    id: 'user-emp-1',
    role: 'Employee',
    companyId: 'COMPANY_A',
    subscriptionId: 'SUB_A',
    employee: { id: 'emp-1' },
    permissions: ['tax:declarations:view', 'tax:declarations:submit'],
  };

  const mockAccountantUser = {
    id: 'user-acc-1',
    role: 'Accountant',
    companyId: 'COMPANY_A',
    subscriptionId: 'SUB_A',
    permissions: ['tax:declarations:manage'],
  };

  describe('Employee Access (My Declarations)', () => {
    it('Employee can fetch their own tax declaration', async () => {
      mockTaxDeclarationService.getMyDeclaration.mockResolvedValue({ id: 'decl-1' });

      const req = { user: mockEmployeeUser } as any;
      const result = await controller.getMyDeclaration(req, 'fy-2026');

      expect(mockTaxDeclarationService.getMyDeclaration).toHaveBeenCalledWith(
        mockEmployeeUser,
        expect.objectContaining({ companyId: 'COMPANY_A' }),
        'fy-2026',
      );
      expect(result).toEqual({ id: 'decl-1' });
    });

    it('Employee can create a draft tax declaration', async () => {
      const dto: CreateTaxDeclarationDto = {
        fiscalYearId: 'fy-2026',
        regime: 'OLD',
        items: [],
      };
      mockTaxDeclarationService.createMyDeclaration.mockResolvedValue({ id: 'decl-1' });

      const req = { user: mockEmployeeUser } as any;
      const result = await controller.createMyDeclaration(req, dto);

      expect(mockTaxDeclarationService.createMyDeclaration).toHaveBeenCalledWith(
        mockEmployeeUser,
        expect.objectContaining({ companyId: 'COMPANY_A' }),
        dto,
      );
      expect(result).toEqual({ id: 'decl-1' });
    });

    it('Employee can update a draft tax declaration', async () => {
      const dto: CreateTaxDeclarationDto = {
        fiscalYearId: 'fy-2026',
        regime: 'NEW',
        items: [],
      };
      mockTaxDeclarationService.updateMyDeclaration.mockResolvedValue({ id: 'decl-1' });

      const req = { user: mockEmployeeUser } as any;
      const result = await controller.updateMyDeclaration(req, dto);

      expect(mockTaxDeclarationService.updateMyDeclaration).toHaveBeenCalledWith(
        mockEmployeeUser,
        expect.objectContaining({ companyId: 'COMPANY_A' }),
        dto,
      );
      expect(result).toEqual({ id: 'decl-1' });
    });

    it('Employee can submit their own tax declaration', async () => {
      mockTaxDeclarationService.submitMyDeclaration.mockResolvedValue({ id: 'decl-1', status: 'SUBMITTED' });

      const req = { user: mockEmployeeUser } as any;
      const result = await controller.submitMyDeclaration(req, { fiscalYearId: 'fy-2026' });

      expect(mockTaxDeclarationService.submitMyDeclaration).toHaveBeenCalledWith(
        mockEmployeeUser,
        expect.objectContaining({ companyId: 'COMPANY_A' }),
        'fy-2026',
      );
      expect(result).toEqual({ id: 'decl-1', status: 'SUBMITTED' });
    });
  });

  describe('Management Access restrictions on Employee', () => {
    it('Employee cannot access tenant-wide declarations list', async () => {
      const decorators = Reflect.getMetadata('permissions', controller.getTenantDeclarations);
      expect(decorators).toContain('tax:declarations:manage');
    });

    it('Employee cannot audit/approve declarations', async () => {
      const decorators = Reflect.getMetadata('permissions', controller.auditDeclaration);
      expect(decorators).toContain('tax:declarations:manage');
    });
  });

  describe('Accountant Access (Tenant-wide Declarations)', () => {
    it('Accountant can list tenant tax declarations', async () => {
      mockTaxDeclarationService.findTenantDeclarations.mockResolvedValue({ data: [] });

      const req = { user: mockAccountantUser } as any;
      const result = await controller.getTenantDeclarations(req, 'fy-2026', undefined, '1', '10');

      expect(mockTaxDeclarationService.findTenantDeclarations).toHaveBeenCalledWith(
        expect.objectContaining({ companyId: 'COMPANY_A' }),
        { fiscalYearId: 'fy-2026', status: undefined, page: 1, limit: 10 },
      );
      expect(result).toEqual({ data: [] });
    });

    it('Accountant can audit an employee tax declaration', async () => {
      const dto: AuditTaxDeclarationDto = {
        decision: 'APPROVED',
        remarks: 'Valid proofs',
        itemApprovals: [],
      };
      mockTaxDeclarationService.auditDeclaration.mockResolvedValue({ id: 'decl-1', status: 'APPROVED' });

      const req = { user: mockAccountantUser } as any;
      const result = await controller.auditDeclaration(req, 'decl-1', dto);

      expect(mockTaxDeclarationService.auditDeclaration).toHaveBeenCalledWith(
        'decl-1',
        expect.objectContaining({ companyId: 'COMPANY_A' }),
        mockAccountantUser,
        dto,
      );
      expect(result).toEqual({ id: 'decl-1', status: 'APPROVED' });
    });
  });
});

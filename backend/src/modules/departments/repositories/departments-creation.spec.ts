import { ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DepartmentsService } from '../services/departments.service';
import { DepartmentsRepository } from './departments.repository';
import { PrismaService } from '../../../prisma/prisma.service';
import { TenantContextService } from '../../../common/tenant/tenant-context.service';

describe('Departments & Designations - HR Admin Creation & Isolation Regression', () => {
  let service: DepartmentsService;
  let repository: DepartmentsRepository;
  let tenantContextService: TenantContextService;
  let mockPrisma: any;

  beforeEach(async () => {
    mockPrisma = {
      department: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        delete: jest.fn(),
      },
      designation: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        delete: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DepartmentsService,
        DepartmentsRepository,
        { provide: PrismaService, useValue: mockPrisma },
        TenantContextService,
      ],
    }).compile();

    service = module.get<DepartmentsService>(DepartmentsService);
    repository = module.get<DepartmentsRepository>(DepartmentsRepository);
    tenantContextService = module.get<TenantContextService>(TenantContextService);
  });

  describe('Department Queries and Listing', () => {
    it('findAllDepartments queries using Subscription ID (SUB_A) instead of Company ID', async () => {
      jest.spyOn(tenantContextService, 'isPlatform').mockReturnValue(false);
      jest.spyOn(tenantContextService, 'getCompanyId').mockReturnValue('COMPANY_A');
      jest.spyOn(tenantContextService, 'getSubscriptionId').mockReturnValue('SUB_A');

      mockPrisma.department.findMany.mockResolvedValue([]);

      await repository.findAllDepartments();

      expect(mockPrisma.department.findMany).toHaveBeenCalledWith({
        where: {
          subscriptionId: 'SUB_A', // MUST NOT be 'COMPANY_A'
        },
        orderBy: { name: 'asc' },
      });
    });

    it('deleteDepartment is successful when subscription matches', async () => {
      jest.spyOn(tenantContextService, 'isPlatform').mockReturnValue(false);
      jest.spyOn(tenantContextService, 'getCompanyId').mockReturnValue('COMPANY_A');
      jest.spyOn(tenantContextService, 'getSubscriptionId').mockReturnValue('SUB_A');

      mockPrisma.department.findUnique.mockResolvedValue({
        id: 'dept-1',
        subscriptionId: 'SUB_A',
      });
      mockPrisma.department.delete.mockResolvedValue({ id: 'dept-1' });

      const result = await service.deleteDepartment('dept-1', 'SUB_A');
      expect(result).toBeDefined();
    });
  });

  describe('Designation Queries and Listing', () => {
    it('findAllDesignations queries using Subscription ID (SUB_A) instead of Company ID', async () => {
      jest.spyOn(tenantContextService, 'isPlatform').mockReturnValue(false);
      jest.spyOn(tenantContextService, 'getCompanyId').mockReturnValue('COMPANY_A');
      jest.spyOn(tenantContextService, 'getSubscriptionId').mockReturnValue('SUB_A');

      mockPrisma.designation.findMany.mockResolvedValue([]);

      await repository.findAllDesignations();

      expect(mockPrisma.designation.findMany).toHaveBeenCalledWith({
        where: {
          subscriptionId: 'SUB_A', // MUST NOT be 'COMPANY_A'
        },
        orderBy: { name: 'asc' },
      });
    });

    it('findDesignationsByDepartment queries using Subscription ID (SUB_A) instead of Company ID', async () => {
      jest.spyOn(tenantContextService, 'isPlatform').mockReturnValue(false);
      jest.spyOn(tenantContextService, 'getCompanyId').mockReturnValue('COMPANY_A');
      jest.spyOn(tenantContextService, 'getSubscriptionId').mockReturnValue('SUB_A');

      mockPrisma.designation.findMany.mockResolvedValue([]);

      await repository.findDesignationsByDepartment('dept-1');

      expect(mockPrisma.designation.findMany).toHaveBeenCalledWith({
        where: {
          departmentId: 'dept-1',
          subscriptionId: 'SUB_A', // MUST NOT be 'COMPANY_A'
        },
        orderBy: { name: 'asc' },
      });
    });
  });

  describe('Department Creation', () => {
    it('HR Admin creates Department successfully with real Subscription ID and Company ID', async () => {
      jest.spyOn(tenantContextService, 'isPlatform').mockReturnValue(false);
      jest.spyOn(tenantContextService, 'getCompanyId').mockReturnValue('COMPANY_A');
      jest.spyOn(tenantContextService, 'getSubscriptionId').mockReturnValue('SUB_A');

      mockPrisma.department.findFirst.mockResolvedValue(null);
      mockPrisma.department.create.mockResolvedValue({
        id: 'dept-1',
        name: 'Engineering',
        subscriptionId: 'SUB_A',
        companyId: 'COMPANY_A',
      });

      const result = await service.createDepartment({ name: 'Engineering' });

      // Verify that lookup checks correct Subscription ID scope (SUB_A)
      expect(mockPrisma.department.findFirst).toHaveBeenCalledWith({
        where: {
          name: 'Engineering',
          subscriptionId: 'SUB_A',
        },
      });

      // Verify that creation writes SUB_A to subscriptionId and COMPANY_A to companyId
      expect(mockPrisma.department.create).toHaveBeenCalledWith({
        data: {
          name: 'Engineering',
          subscriptionId: 'SUB_A',
          companyId: 'COMPANY_A',
        },
      });

      expect(result.name).toBe('Engineering');
    });

    it('Duplicate Department is rejected', async () => {
      jest.spyOn(tenantContextService, 'isPlatform').mockReturnValue(false);
      jest.spyOn(tenantContextService, 'getCompanyId').mockReturnValue('COMPANY_A');
      jest.spyOn(tenantContextService, 'getSubscriptionId').mockReturnValue('SUB_A');

      // Return existing department using the correct subscriptionId (SUB_A)
      mockPrisma.department.findFirst.mockResolvedValue({
        id: 'dept-1',
        name: 'Engineering',
        subscriptionId: 'SUB_A',
        companyId: 'COMPANY_A',
      });

      await expect(
        service.createDepartment({ name: 'Engineering' }),
      ).rejects.toThrow(ConflictException);

      expect(mockPrisma.department.create).not.toHaveBeenCalled();
    });
  });

  describe('Designation Creation', () => {
    it('HR Admin creates Designation successfully with real Subscription ID and Company ID', async () => {
      jest.spyOn(tenantContextService, 'isPlatform').mockReturnValue(false);
      jest.spyOn(tenantContextService, 'getCompanyId').mockReturnValue('COMPANY_A');
      jest.spyOn(tenantContextService, 'getSubscriptionId').mockReturnValue('SUB_A');

      mockPrisma.designation.findFirst.mockResolvedValue(null);
      mockPrisma.designation.create.mockResolvedValue({
        id: 'desig-1',
        name: 'Software Engineer',
        band: 'L1',
        subscriptionId: 'SUB_A',
        companyId: 'COMPANY_A',
      });

      const result = await service.createDesignation({
        name: 'Software Engineer',
        band: 'L1',
      });

      // Verify that lookup checks correct Subscription ID scope (SUB_A)
      expect(mockPrisma.designation.findFirst).toHaveBeenCalledWith({
        where: {
          name: 'Software Engineer',
          subscriptionId: 'SUB_A',
        },
      });

      expect(result.name).toBe('Software Engineer');
    });

    it('Duplicate Designation is rejected', async () => {
      jest.spyOn(tenantContextService, 'isPlatform').mockReturnValue(false);
      jest.spyOn(tenantContextService, 'getCompanyId').mockReturnValue('COMPANY_A');
      jest.spyOn(tenantContextService, 'getSubscriptionId').mockReturnValue('SUB_A');

      // Return existing designation using correct subscriptionId (SUB_A)
      mockPrisma.designation.findFirst.mockResolvedValue({
        id: 'desig-1',
        name: 'Software Engineer',
        band: 'L1',
        subscriptionId: 'SUB_A',
        companyId: 'COMPANY_A',
      });

      await expect(
        service.createDesignation({ name: 'Software Engineer', band: 'L1' }),
      ).rejects.toThrow(ConflictException);
    });
  });
});

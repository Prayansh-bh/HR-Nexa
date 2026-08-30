import { Test, TestingModule } from '@nestjs/testing';
import { EmployeesService } from './employees.service';
import { EmployeesRepository } from '../repositories/employees.repository';
import { EmployeeUserLinkService } from './employee-user-link.service';
import { EmployeeDepartmentSyncService } from './employee-department-sync.service';
import { SeatLimitService } from '../../subscriptions/services/seat-limit.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { TenantContextService } from '../../../common/tenant/tenant-context.service';
import { StorageService } from '../../../common/storage/storage.service';
import { NotFoundException } from '@nestjs/common';

describe('PHASE 2H ADVERSARIAL: Multi-Tenant Isolation & IDOR Attacks', () => {
  let service: EmployeesService;
  let repository: EmployeesRepository;

  const mockEmployeesRepo = {
    findById: jest.fn(),
    findByIdAndTenant: jest.fn(),
    findByCompany: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };

  const mockEmployeeUserLinkService = { syncUserForEmployee: jest.fn() };
  const mockEmployeeDeptSyncService = { syncDepartmentAndDesignation: jest.fn() };
  const mockSeatLimitService = { validateSeatLimit: jest.fn() };
  const mockPrisma = { employee: { findFirst: jest.fn(), update: jest.fn() } };
  const mockEventEmitter = { emit: jest.fn() };
  const mockTenantContextService = { getTenantId: jest.fn().mockReturnValue('TENANT_A') };
  const mockStorageService = { uploadFile: jest.fn(), deleteFile: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmployeesService,
        { provide: EmployeesRepository, useValue: mockEmployeesRepo },
        { provide: EmployeeUserLinkService, useValue: mockEmployeeUserLinkService },
        { provide: EmployeeDepartmentSyncService, useValue: mockEmployeeDeptSyncService },
        { provide: SeatLimitService, useValue: mockSeatLimitService },
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EventEmitter2, useValue: mockEventEmitter },
        { provide: TenantContextService, useValue: mockTenantContextService },
        { provide: StorageService, useValue: mockStorageService },
      ],
    }).compile();

    service = module.get<EmployeesService>(EmployeesService);
    repository = module.get<EmployeesRepository>(EmployeesRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const tenantAUser = {
    id: 'user-a-1',
    role: 'HR Admin',
    companyId: 'TENANT_A',
    subscriptionId: 'SUB_A',
    permissions: ['employees:read', 'employees:update', 'employees:delete'],
  };

  describe('Attack 1: Tenant A Attempting to Read Tenant B Employee (IDOR)', () => {
    it('MUST REJECT Tenant A reading Tenant B employee record', async () => {
      mockEmployeesRepo.findById.mockResolvedValue({
        id: 'emp-b-999',
        companyId: 'TENANT_B',
        name: 'Tenant B Secret Executive',
      });

      await expect(service.findOne(tenantAUser, 'emp-b-999')).rejects.toThrow(NotFoundException);
    });
  });

  describe('Attack 2: Tenant A Attempting to Mutate Tenant B Employee', () => {
    it('MUST REJECT Tenant A updating Tenant B employee record', async () => {
      mockEmployeesRepo.findById.mockResolvedValue({
        id: 'emp-b-999',
        companyId: 'TENANT_B',
        name: 'Tenant B Employee',
      });

      await expect(
        service.update(tenantAUser, 'emp-b-999', { name: 'Hacked Name' } as any)
      ).rejects.toThrow(NotFoundException);

      expect(mockEmployeesRepo.update).not.toHaveBeenCalled();
    });
  });

  describe('Attack 3: Tenant A Attempting to Delete Tenant B Employee', () => {
    it('MUST REJECT Tenant A deleting Tenant B employee record', async () => {
      mockEmployeesRepo.findById.mockResolvedValue({
        id: 'emp-b-999',
        companyId: 'TENANT_B',
        name: 'Tenant B Employee',
      });

      await expect(service.remove(tenantAUser, 'emp-b-999')).rejects.toThrow(NotFoundException);
      expect(mockEmployeesRepo.delete).not.toHaveBeenCalled();
    });
  });

  describe('Attack 4: Nonexistent Resource Access', () => {
    it('MUST throw NotFoundException for non-existent employee ID', async () => {
      mockEmployeesRepo.findById.mockResolvedValue(null);
      await expect(service.findOne(tenantAUser, 'non-existent-id')).rejects.toThrow(NotFoundException);
    });
  });
});

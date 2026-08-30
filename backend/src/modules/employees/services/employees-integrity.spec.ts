import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { EmployeesService } from './employees.service';
import { EmployeesRepository } from '../repositories/employees.repository';
import { PrismaService } from '../../../prisma/prisma.service';
import { SeatLimitService } from '../../subscriptions/services/seat-limit.service';
import { EmployeeUserLinkService } from './employee-user-link.service';
import { EmployeeDepartmentSyncService } from './employee-department-sync.service';
import { TenantContextService } from '../../../common/tenant/tenant-context.service';
import { StorageService } from '../../../common/storage/storage.service';

describe('EmployeesService - Phase 4 Backend Integrity & Server-Side Identity', () => {
  let service: EmployeesService;
  let prisma: any;
  let repo: any;
  let seatLimit: any;
  let userLink: any;
  let eventEmitter: any;

  const mockCurrentUser = {
    id: 'user-admin-1',
    companyId: 'company-acme',
    subscriptionId: 'sub-acme',
    role: 'HRAdmin',
    email: 'admin@acme.co',
  };

  beforeEach(async () => {
    prisma = {
      $transaction: jest.fn().mockImplementation(async (cb) => cb(prisma)),
      employee: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation((args) => Promise.resolve({ ...args.data })),
      },
      user: {
        update: jest.fn().mockResolvedValue({ id: 'user-1' }),
      },
      department: {
        findFirst: jest.fn().mockResolvedValue({ id: 'dept-1', name: 'Engineering' }),
        create: jest.fn().mockResolvedValue({ id: 'dept-1', name: 'Engineering' }),
      },
      designation: {
        findFirst: jest.fn().mockResolvedValue({ id: 'desig-1', name: 'Software Engineer' }),
        create: jest.fn().mockResolvedValue({ id: 'desig-1', name: 'Software Engineer' }),
      },
      subscription: {
        findUnique: jest.fn().mockResolvedValue({ id: 'sub-acme', company: 'Acme Corp' }),
      },
      role: {
        findUnique: jest.fn().mockResolvedValue({ id: 'role-emp', name: 'Employee' }),
      },
    };

    repo = {
      findById: jest.fn().mockResolvedValue(null),
      findByEmail: jest.fn().mockResolvedValue(null),
      findByIdAndTenant: jest.fn().mockResolvedValue(null),
    };

    seatLimit = {
      verifyCanAddEmployee: jest.fn().mockResolvedValue(undefined),
      syncEmployeeCounts: jest.fn().mockResolvedValue(undefined),
    };

    userLink = {
      getOrCreateUserForEmployee: jest.fn().mockResolvedValue('user-new-1'),
    };

    eventEmitter = {
      emit: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmployeesService,
        { provide: PrismaService, useValue: prisma },
        { provide: EmployeesRepository, useValue: repo },
        { provide: EmployeeDepartmentSyncService, useValue: { syncEmployeeCount: jest.fn() } },
        { provide: SeatLimitService, useValue: seatLimit },
        { provide: EmployeeUserLinkService, useValue: userLink },
        { provide: EventEmitter2, useValue: eventEmitter },
        { provide: TenantContextService, useValue: null },
        { provide: StorageService, useValue: null },
      ],
    }).compile();

    service = module.get<EmployeesService>(EmployeesService);
  });

  describe('1. Server-Side ID Generation', () => {
    it('should generate EMP001 when no EMP IDs exist in the database', async () => {
      prisma.employee.findMany.mockResolvedValue([]);
      prisma.employee.findUnique.mockResolvedValue(null);

      const generatedId = await service.generateNextEmployeeId('company-acme');
      expect(generatedId).toBe('EMP001');
    });

    it('should generate EMP007 when EMP001 through EMP006 exist', async () => {
      prisma.employee.findMany.mockResolvedValue([
        { id: 'EMP001' },
        { id: 'EMP002' },
        { id: 'EMP003' },
        { id: 'EMP005' },
        { id: 'EMP006' },
      ]);
      prisma.employee.findUnique.mockResolvedValue(null);

      const generatedId = await service.generateNextEmployeeId('company-acme');
      expect(generatedId).toBe('EMP007');
    });

    it('should skip collision if candidate ID already exists in unique check', async () => {
      prisma.employee.findMany.mockResolvedValue([{ id: 'EMP005' }]);
      // First findUnique checks EMP006 -> exists, next findUnique checks EMP007 -> null
      prisma.employee.findUnique
        .mockResolvedValueOnce({ id: 'EMP006' })
        .mockResolvedValueOnce(null);

      const generatedId = await service.generateNextEmployeeId('company-acme');
      expect(generatedId).toBe('EMP007');
    });
  });

  describe('2. Single-Employee Creation Contract Preservation', () => {
    it('should automatically assign server-generated ID if createDto.id is omitted', async () => {
      prisma.employee.findMany.mockResolvedValue([{ id: 'EMP003' }]);
      prisma.employee.findUnique.mockResolvedValue(null);

      const createDto: any = {
        name: 'John Doe',
        email: 'john.doe@acme.co',
        departmentName: 'Engineering',
        designation: 'Software Engineer',
        status: 'Active',
        joined: '2026-06-01',
        salary: 75000,
        avatar: 'JD',
      };

      const result = await service.create(mockCurrentUser, createDto);

      expect(result.id).toBe('EMP004');
      expect(seatLimit.verifyCanAddEmployee).toHaveBeenCalledWith('sub-acme', prisma);
      expect(eventEmitter.emit).toHaveBeenCalled();
    });

    it('should preserve explicitly provided employee ID if supplied', async () => {
      const createDto: any = {
        id: 'EMP-CUSTOM-99',
        name: 'Jane Smith',
        email: 'jane.smith@acme.co',
        departmentName: 'Engineering',
        designation: 'Software Engineer',
        status: 'Active',
        joined: '2026-06-01',
        salary: 85000,
        avatar: 'JS',
      };

      const result = await service.create(mockCurrentUser, createDto);

      expect(result.id).toBe('EMP-CUSTOM-99');
      expect(repo.findById).toHaveBeenCalledWith('EMP-CUSTOM-99');
    });

    it('should reject creation if email already exists', async () => {
      repo.findByEmail.mockResolvedValue({ id: 'EMP001', email: 'existing@acme.co' });

      const createDto: any = {
        name: 'Duplicate User',
        email: 'existing@acme.co',
        departmentName: 'Engineering',
        designation: 'Software Engineer',
        status: 'Active',
        joined: '2026-06-01',
        salary: 80000,
        avatar: 'DU',
      };

      await expect(service.create(mockCurrentUser, createDto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should reject creation if explicit ID already exists', async () => {
      repo.findById.mockResolvedValue({ id: 'EMP001' });

      const createDto: any = {
        id: 'EMP001',
        name: 'Duplicate ID User',
        email: 'new@acme.co',
        departmentName: 'Engineering',
        designation: 'Software Engineer',
        status: 'Active',
        joined: '2026-06-01',
        salary: 80000,
        avatar: 'DU',
      };

      await expect(service.create(mockCurrentUser, createDto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should require tenant context (companyId)', async () => {
      const userWithoutTenant = { id: 'u1', companyId: null, subscriptionId: null };

      const createDto: any = {
        name: 'No Tenant User',
        email: 'notenant@acme.co',
        departmentName: 'Engineering',
        designation: 'Software Engineer',
        status: 'Active',
        joined: '2026-06-01',
        salary: 80000,
        avatar: 'NT',
      };

      await expect(service.create(userWithoutTenant, createDto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});

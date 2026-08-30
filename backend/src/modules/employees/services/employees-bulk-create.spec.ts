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
import { ConflictException, BadRequestException } from '@nestjs/common';
import { BulkCreateEmployeeDto } from '../dto/bulk-create-employee.dto';
import { CreateEmployeeDto } from '../dto/create-employee.dto';

describe('EmployeesService - bulkCreate (Phase 1 Contract)', () => {
  let service: EmployeesService;

  const mockCurrentUser = {
    id: 'user-admin',
    email: 'admin@acme.co',
    role: 'HRAdmin',
    companyId: 'comp-100',
    subscriptionId: 'sub-100',
  };

  const sampleEmployeeDto = (num: number): CreateEmployeeDto => ({
    id: `EMP00${num}`,
    name: `Employee ${num}`,
    email: `employee${num}@acme.co`,
    departmentName: 'Engineering',
    designation: 'Software Engineer',
    status: 'Active',
    joined: '2026-07-21',
    salary: 80000,
    avatar: `E${num}`,
  });

  const mockEmployeesRepository = {
    findMany: jest.fn(),
    findAll: jest.fn(),
    findById: jest.fn(),
    findByIdAndTenant: jest.fn(),
    findByEmail: jest.fn(),
    findByEmployeeId: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };

  const mockEmployeeUserLinkService = {
    ensureUserForEmployee: jest.fn(),
    getOrCreateUserForEmployee: jest.fn(),
  };

  const mockEmployeeDepartmentSyncService = {
    syncDepartmentHeadName: jest.fn(),
  };

  const mockSeatLimitService = {
    verifyCanAddEmployee: jest.fn(),
    syncEmployeeCounts: jest.fn(),
  };

  const mockStorageService = {
    saveFile: jest.fn(),
    deleteFile: jest.fn(),
    validateFile: jest.fn(),
    getFileStream: jest.fn(),
  };

  const mockPrismaService = {
    $transaction: jest.fn((cb) => cb(mockPrismaService)),
    user: { update: jest.fn().mockResolvedValue({}) },
    employee: {
      create: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
    subscription: { findFirst: jest.fn(), findUnique: jest.fn() },
    department: { findFirst: jest.fn(), create: jest.fn() },
    designation: { findFirst: jest.fn(), create: jest.fn() },
  };

  const mockEventEmitter = {
    emit: jest.fn(),
  };

  const mockTenantContextService = {
    isPlatform: jest.fn().mockReturnValue(false),
    getCompanyId: jest.fn().mockReturnValue('comp-100'),
    getSubscriptionId: jest.fn().mockReturnValue('sub-100'),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmployeesService,
        { provide: EmployeesRepository, useValue: mockEmployeesRepository },
        {
          provide: EmployeeUserLinkService,
          useValue: mockEmployeeUserLinkService,
        },
        {
          provide: EmployeeDepartmentSyncService,
          useValue: mockEmployeeDepartmentSyncService,
        },
        { provide: SeatLimitService, useValue: mockSeatLimitService },
        { provide: StorageService, useValue: mockStorageService },
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: EventEmitter2, useValue: mockEventEmitter },
        { provide: TenantContextService, useValue: mockTenantContextService },
      ],
    }).compile();

    service = module.get<EmployeesService>(EmployeesService);
  });

  describe('Test 1 — Full success', () => {
    it('should successfully create all valid employees and return 3 total, 3 successful, 0 failed', async () => {
      const createSpy = jest
        .spyOn(service, 'create')
        .mockImplementation(async (user: any, dto: any) => ({
          ...dto,
          companyId: user.companyId,
          subscriptionId: user.subscriptionId,
        } as any));

      const bulkDto: BulkCreateEmployeeDto = {
        employees: [
          sampleEmployeeDto(1),
          sampleEmployeeDto(2),
          sampleEmployeeDto(3),
        ],
      };

      const result = await service.bulkCreate(mockCurrentUser, bulkDto);

      expect(createSpy).toHaveBeenCalledTimes(3);
      expect(result.total).toBe(3);
      expect(result.successful).toBe(3);
      expect(result.failed).toBe(0);
      expect(result.errors).toHaveLength(0);
      expect(result.createdEmployees).toHaveLength(3);
      expect(result.createdEmployees[0].id).toBe('EMP001');
    });
  });

  describe('Test 2 — Partial failure', () => {
    it('should record duplicate email conflict as a structured error for row 2 without crashing', async () => {
      const createSpy = jest
        .spyOn(service, 'create')
        .mockImplementation(async (user: any, dto: any) => {
          if (dto?.email === 'employee2@acme.co') {
            throw new ConflictException(
              `Employee with email ${dto.email} already exists`,
            );
          }
          return {
            ...dto,
            companyId: user.companyId,
            subscriptionId: user.subscriptionId,
          } as any;
        });

      const bulkDto: BulkCreateEmployeeDto = {
        employees: [
          sampleEmployeeDto(1),
          sampleEmployeeDto(2),
          sampleEmployeeDto(3),
        ],
      };

      const result = await service.bulkCreate(mockCurrentUser, bulkDto);

      expect(createSpy).toHaveBeenCalledTimes(3);
      expect(result.total).toBe(3);
      expect(result.successful).toBe(2);
      expect(result.failed).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toEqual({
        row: 2,
        index: 1,
        id: 'EMP002',
        email: 'employee2@acme.co',
        name: 'Employee 2',
        reason: 'Employee with email employee2@acme.co already exists',
        code: 'DUPLICATE_RECORD',
      });
      expect(result.createdEmployees).toHaveLength(2);
      expect(result.createdEmployees.map((e) => e.id)).toEqual([
        'EMP001',
        'EMP003',
      ]);
    });
  });

  describe('Test 3 — Error isolation', () => {
    it('should continue processing remaining rows when an earlier row fails', async () => {
      let callCount = 0;
      jest.spyOn(service, 'create').mockImplementation(async (user: any, dto: any) => {
        callCount++;
        if (callCount === 2) {
          throw new BadRequestException('Invalid employee data');
        }
        return { ...dto, companyId: user.companyId } as any;
      });

      const bulkDto: BulkCreateEmployeeDto = {
        employees: [
          sampleEmployeeDto(1),
          sampleEmployeeDto(2),
          sampleEmployeeDto(3),
        ],
      };

      const result = await service.bulkCreate(mockCurrentUser, bulkDto);

      expect(callCount).toBe(3);
      expect(result.successful).toBe(2);
      expect(result.failed).toBe(1);
      expect(result.errors[0].row).toBe(2);
      expect(result.createdEmployees[1].id).toBe('EMP003');
    });
  });

  describe('Test 4 — Tenant context', () => {
    it('should pass the identical authenticated user context to every create invocation', async () => {
      const createSpy = jest
        .spyOn(service, 'create')
        .mockResolvedValue({ id: 'EMP001' } as any);

      const bulkDto: BulkCreateEmployeeDto = {
        employees: [sampleEmployeeDto(1), sampleEmployeeDto(2)],
      };

      await service.bulkCreate(mockCurrentUser, bulkDto);

      expect(createSpy).toHaveBeenNthCalledWith(
        1,
        mockCurrentUser,
        bulkDto.employees[0],
      );
      expect(createSpy).toHaveBeenNthCalledWith(
        2,
        mockCurrentUser,
        bulkDto.employees[1],
      );
    });
  });

  describe('Test 5 — Seat-limit failure', () => {
    it('should transform seat limit exception into a structured row error and keep processing other rows', async () => {
      jest.spyOn(service, 'create').mockImplementation(async (user: any, dto: any) => {
        if (dto?.id === 'EMP002') {
          throw new BadRequestException({
            statusCode: 400,
            error: 'Bad Request',
            message: 'Seat limit reached for company subscription.',
            errorCode: 'SEAT_LIMIT_REACHED',
          });
        }
        return { ...dto, companyId: user.companyId } as any;
      });

      const bulkDto: BulkCreateEmployeeDto = {
        employees: [sampleEmployeeDto(1), sampleEmployeeDto(2)],
      };

      const result = await service.bulkCreate(mockCurrentUser, bulkDto);

      expect(result.total).toBe(2);
      expect(result.successful).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.errors[0].code).toBe('SEAT_LIMIT_REACHED');
      expect(result.errors[0].reason).toContain('Seat limit reached');
    });
  });

  describe('Test 6 — Result structure & invariant consistency', () => {
    it('should maintain mathematical invariant: successful + failed === total', async () => {
      jest.spyOn(service, 'create').mockImplementation(async (user: any, dto: any) => {
        if (dto?.id === 'EMP002' || dto?.id === 'EMP004') {
          throw new Error('Database temporary connection failure');
        }
        return { ...dto } as any;
      });

      const bulkDto: BulkCreateEmployeeDto = {
        employees: [
          sampleEmployeeDto(1),
          sampleEmployeeDto(2),
          sampleEmployeeDto(3),
          sampleEmployeeDto(4),
          sampleEmployeeDto(5),
        ],
      };

      const result = await service.bulkCreate(mockCurrentUser, bulkDto);

      expect(result.total).toBe(5);
      expect(result.successful).toBe(3);
      expect(result.failed).toBe(2);
      expect(result.successful + result.failed).toBe(result.total);
      expect(result.createdEmployees).toHaveLength(3);
      expect(result.errors).toHaveLength(2);
    });
  });
});

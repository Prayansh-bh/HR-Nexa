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

describe('EmployeesService - Phase 6 Production Hardening & Concurrency Protection', () => {
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
        create: jest
          .fn()
          .mockImplementation((args) => Promise.resolve({ ...args.data })),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest
          .fn()
          .mockImplementation((args) =>
            Promise.resolve({ id: 'user-created-1', ...args.data }),
          ),
        update: jest.fn().mockResolvedValue({ id: 'user-1' }),
      },
      department: {
        findFirst: jest
          .fn()
          .mockResolvedValue({ id: 'dept-1', name: 'Engineering' }),
        create: jest
          .fn()
          .mockResolvedValue({ id: 'dept-1', name: 'Engineering' }),
      },
      designation: {
        findFirst: jest
          .fn()
          .mockResolvedValue({ id: 'desig-1', name: 'Software Engineer' }),
        create: jest
          .fn()
          .mockResolvedValue({ id: 'desig-1', name: 'Software Engineer' }),
      },
      subscription: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: 'sub-acme', company: 'Acme Corp' }),
      },
      role: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: 'role-emp', name: 'Employee' }),
      },
      idempotencyKey: {
        findUnique: jest.fn().mockResolvedValue(null),
        upsert: jest.fn().mockResolvedValue({ status: 'PENDING' }),
        update: jest.fn().mockResolvedValue({ status: 'COMPLETED' }),
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
        {
          provide: EmployeeDepartmentSyncService,
          useValue: { syncEmployeeCount: jest.fn() },
        },
        { provide: SeatLimitService, useValue: seatLimit },
        { provide: EmployeeUserLinkService, useValue: userLink },
        { provide: EventEmitter2, useValue: eventEmitter },
        { provide: TenantContextService, useValue: null },
        { provide: StorageService, useValue: null },
      ],
    }).compile();

    service = module.get<EmployeesService>(EmployeesService);
  });

  describe('Fix #1: Concurrent Employee ID Generation & Collision Retry', () => {
    it('should transparently retry on auto-generated ID P2002 collision and succeed with next ID', async () => {
      // First attempt produces EMP011 which hits P2002 collision.
      // Second attempt generates EMP012 and succeeds!
      const p2002Error: any = new Error('Unique constraint failed on the fields: (id)');
      p2002Error.code = 'P2002';
      p2002Error.meta = { target: ['id'] };

      prisma.employee.findMany
        .mockResolvedValueOnce([{ id: 'EMP010' }])
        .mockResolvedValueOnce([{ id: 'EMP010' }, { id: 'EMP011' }]);

      prisma.employee.create
        .mockRejectedValueOnce(p2002Error)
        .mockResolvedValueOnce({
          id: 'EMP012',
          name: 'John Concurrent',
          email: 'john.concurrent@acme.co',
        });

      const createDto: any = {
        name: 'John Concurrent',
        email: 'john.concurrent@acme.co',
        departmentName: 'Engineering',
        designation: 'Software Engineer',
        status: 'Active',
        joined: '2026-06-01',
        salary: 80000,
      };

      const result = await service.create(mockCurrentUser, createDto);

      expect(result.id).toBe('EMP012');
      expect(prisma.employee.create).toHaveBeenCalledTimes(2);
      expect(eventEmitter.emit).toHaveBeenCalledTimes(2); // EMPLOYEE_EVENTS.CREATED, user.created
    });

    it('should NOT retry if duplicate ID was explicitly supplied by caller', async () => {
      const p2002Error: any = new Error('Unique constraint failed on the fields: (id)');
      p2002Error.code = 'P2002';
      p2002Error.meta = { target: ['id'] };

      prisma.employee.create.mockRejectedValue(p2002Error);

      const createDto: any = {
        id: 'EMP-EXPLICIT-99',
        name: 'Explicit Duplicate',
        email: 'explicit@acme.co',
        departmentName: 'Engineering',
        designation: 'Software Engineer',
        status: 'Active',
        joined: '2026-06-01',
        salary: 80000,
      };

      await expect(service.create(mockCurrentUser, createDto)).rejects.toThrow();
      expect(prisma.employee.create).toHaveBeenCalledTimes(1);
    });

    it('should throw ConflictException if duplicate email collision occurs', async () => {
      const emailP2002Error: any = new Error('Unique constraint failed on the fields: (email)');
      emailP2002Error.code = 'P2002';
      emailP2002Error.meta = { target: ['email'] };

      prisma.employee.create.mockRejectedValue(emailP2002Error);

      const createDto: any = {
        name: 'Email Collision',
        email: 'collision@acme.co',
        departmentName: 'Engineering',
        designation: 'Software Engineer',
        status: 'Active',
        joined: '2026-06-01',
        salary: 80000,
      };

      await expect(service.create(mockCurrentUser, createDto)).rejects.toThrow(
        ConflictException,
      );
      expect(prisma.employee.create).toHaveBeenCalledTimes(1);
    });

    it('should exhaust retries and fail cleanly if ID collision happens 5 consecutive times', async () => {
      const p2002Error: any = new Error('Unique constraint failed on the fields: (id)');
      p2002Error.code = 'P2002';
      p2002Error.meta = { target: ['id'] };

      prisma.employee.create.mockRejectedValue(p2002Error);

      const createDto: any = {
        name: 'Exhausted Collision',
        email: 'exhausted@acme.co',
        departmentName: 'Engineering',
        designation: 'Software Engineer',
        status: 'Active',
        joined: '2026-06-01',
        salary: 80000,
      };

      await expect(service.create(mockCurrentUser, createDto)).rejects.toThrow(
        'Failed to allocate unique employee ID after multiple concurrent attempts. Please retry.',
      );
      expect(prisma.employee.create).toHaveBeenCalledTimes(5);
    });
  });

  describe('Fix #2: Orphan User Transaction Scoping', () => {
    it('should pass transactional client to getOrCreateUserForEmployee', async () => {
      const createDto: any = {
        name: 'Transaction User',
        email: 'txuser@acme.co',
        departmentName: 'Engineering',
        designation: 'Software Engineer',
        status: 'Active',
        joined: '2026-06-01',
        salary: 80000,
      };

      await service.create(mockCurrentUser, createDto);

      expect(userLink.getOrCreateUserForEmployee).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'txuser@acme.co',
          prismaClient: prisma, // Participates in transaction
          deferWelcomeEmail: true,
        }),
      );
    });
  });

  describe('Fix #4: Idempotency & Duplicate Prevention', () => {
    it('should return cached result when identical completed idempotency key is submitted', async () => {
      const cachedResponse = {
        total: 2,
        successful: 2,
        failed: 0,
        createdEmployees: [{ id: 'EMP001' }, { id: 'EMP002' }],
        errors: [],
      };

      prisma.idempotencyKey.findUnique.mockResolvedValue({
        key: 'company-acme:bulk_onboard:my-custom-key',
        status: 'COMPLETED',
        result: cachedResponse,
      });

      const bulkDto: any = {
        employees: [
          { name: 'Emp 1', email: 'e1@acme.co', departmentName: 'D', designation: 'D', salary: 10 },
          { name: 'Emp 2', email: 'e2@acme.co', departmentName: 'D', designation: 'D', salary: 20 },
        ],
      };

      const result = await service.bulkCreate(
        mockCurrentUser,
        bulkDto,
        'my-custom-key',
      );

      expect(result).toEqual(cachedResponse);
      // create() should not have been called because it was a cache hit!
      expect(repo.findById).not.toHaveBeenCalled();
    });

    it('should reject with ConflictException if identical idempotency key is currently PENDING', async () => {
      prisma.idempotencyKey.findUnique.mockResolvedValue({
        key: 'company-acme:bulk_onboard:active-key',
        status: 'PENDING',
        createdAt: new Date(), // Active right now
      });

      const bulkDto: any = {
        employees: [
          { name: 'Emp 1', email: 'e1@acme.co', departmentName: 'D', designation: 'D', salary: 10 },
        ],
      };

      await expect(
        service.bulkCreate(mockCurrentUser, bulkDto, 'active-key'),
      ).rejects.toThrow(ConflictException);
    });
  });
});

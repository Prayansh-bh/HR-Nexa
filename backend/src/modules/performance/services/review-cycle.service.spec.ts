import { BadRequestException } from '@nestjs/common';
import { ReviewCycleService } from './review-cycle.service';
import { ReviewCycleRepository } from '../repositories/review-cycle.repository';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateReviewCycleDto } from '../dto/create-review-cycle.dto';
import { PERFORMANCE_EVENTS } from '../../../common/events/performance.events';

describe('ReviewCycleService - Production Scope & Participant Validation', () => {
  let service: ReviewCycleService;
  let mockRepository: Partial<ReviewCycleRepository>;
  let mockEventEmitter: Partial<EventEmitter2>;
  let mockPrisma: any;

  const mockCompanyId = 'company-tenant-alpha';
  const mockCompanyName = 'Alpha Corp';
  const mockUserId = 'hr-admin-user-id';

  // Mock employee fixtures
  const eligibleActiveEmp = {
    id: 'emp-active-1',
    companyId: mockCompanyId,
    status: 'Active',
    name: 'Alice Active',
    user: { id: 'user-1', role: 'Employee' },
  };

  const eligibleOnLeaveEmp = {
    id: 'emp-onleave-2',
    companyId: mockCompanyId,
    status: 'On Leave',
    name: 'Bob OnLeave',
    user: { id: 'user-2', role: 'Manager' },
  };

  const hrAdminEmp = {
    id: 'emp-hradmin-3',
    companyId: mockCompanyId,
    status: 'Active',
    name: 'Carol HRAdmin',
    user: { id: 'user-3', role: 'HR Admin' },
  };

  const terminatedEmp = {
    id: 'emp-terminated-4',
    companyId: mockCompanyId,
    status: 'Terminated',
    name: 'Dave Inactive',
    user: { id: 'user-4', role: 'Employee' },
  };

  const crossTenantEmp = {
    id: 'emp-cross-tenant-99',
    companyId: 'other-company-beta',
    status: 'Active',
    name: 'Eve CrossTenant',
    user: { id: 'user-99', role: 'Employee' },
  };

  let mockCreatedCycles: any[] = [];
  let mockCreatedParticipants: any[] = [];

  beforeEach(() => {
    mockCreatedCycles = [];
    mockCreatedParticipants = [];

    mockRepository = {
      create: jest.fn().mockImplementation(async (companyId, companyName, data, tx) => {
        const cycle = {
          id: `cycle-${Date.now()}-${Math.random()}`,
          companyId,
          ...data,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        mockCreatedCycles.push(cycle);
        return cycle;
      }),
      findMany: jest.fn(),
      findById: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    mockEventEmitter = {
      emit: jest.fn(),
    };

    // Prisma Transaction Client Mock
    const mockTx = {
      employee: {
        findMany: jest.fn().mockImplementation(async ({ where }) => {
          const allEmployees = [
            eligibleActiveEmp,
            eligibleOnLeaveEmp,
            hrAdminEmp,
            terminatedEmp,
            crossTenantEmp,
          ];

          return allEmployees.filter((emp) => {
            const matchesCompany = where.companyId ? emp.companyId === where.companyId : true;
            const matchesStatus =
              where.status && where.status.in
                ? where.status.in.includes(emp.status)
                : true;
            return matchesCompany && matchesStatus;
          });
        }),
      },
      reviewCycleParticipant: {
        createMany: jest.fn().mockImplementation(async ({ data }) => {
          mockCreatedParticipants.push(...data);
          return { count: data.length };
        }),
      },
    };

    mockPrisma = {
      $transaction: jest.fn().mockImplementation(async (cb) => {
        return cb(mockTx);
      }),
    };

    service = new ReviewCycleService(
      mockRepository as ReviewCycleRepository,
      mockEventEmitter as EventEmitter2,
      mockPrisma as PrismaService,
    );
  });

  describe('1. Company-wide Cycle (participantScope = ALL)', () => {
    it('creates cycle and enrolls all eligible active and on-leave employees, excluding HR Admin', async () => {
      const dto: CreateReviewCycleDto = {
        name: '2026 Q3 Company Assessment',
        description: 'All-hands evaluation',
        reviewType: 'Quarterly',
        startDate: '2026-08-19',
        endDate: '2026-11-17',
        deadline: '2026-11-27',
        participantScope: 'ALL',
      };

      const result = await service.create(
        mockCompanyId,
        mockCompanyName,
        dto,
        mockUserId,
      );

      expect(result).toBeDefined();
      expect(result.name).toBe(dto.name);
      expect(mockCreatedCycles).toHaveLength(1);
      expect(mockCreatedParticipants).toHaveLength(2);

      const enrolledIds = mockCreatedParticipants.map((p) => p.employeeId);
      expect(enrolledIds).toContain('emp-active-1');
      expect(enrolledIds).toContain('emp-onleave-2');
      expect(enrolledIds).not.toContain('emp-hradmin-3'); // Excludes HR Admin
      expect(enrolledIds).not.toContain('emp-terminated-4'); // Excludes Inactive
      expect(enrolledIds).not.toContain('emp-cross-tenant-99'); // Excludes other tenant

      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        PERFORMANCE_EVENTS.CYCLE_CREATED,
        expect.objectContaining({
          cycleId: result.id,
          name: dto.name,
          companyId: mockCompanyId,
        }),
      );
    });

    it('defaults to ALL when participantScope is omitted', async () => {
      const dto: CreateReviewCycleDto = {
        name: 'Default Scope Cycle',
        startDate: '2026-08-19',
        endDate: '2026-11-17',
        deadline: '2026-11-27',
      };

      const result = await service.create(
        mockCompanyId,
        mockCompanyName,
        dto,
        mockUserId,
      );

      expect(result).toBeDefined();
      expect(mockCreatedParticipants).toHaveLength(2);
      expect(mockCreatedParticipants.map((p) => p.employeeId)).toEqual([
        'emp-active-1',
        'emp-onleave-2',
      ]);
    });
  });

  describe('2. Specific Participants Cycle (participantScope = SELECTED)', () => {
    it('creates cycle and enrolls exactly the requested eligible employees', async () => {
      const dto: CreateReviewCycleDto = {
        name: 'Selected Dept Cycle',
        reviewType: 'Quarterly',
        startDate: '2026-08-19',
        endDate: '2026-11-17',
        deadline: '2026-11-27',
        participantScope: 'SELECTED',
        participantIds: ['emp-active-1'],
      };

      const result = await service.create(
        mockCompanyId,
        mockCompanyName,
        dto,
        mockUserId,
      );

      expect(result).toBeDefined();
      expect(mockCreatedParticipants).toHaveLength(1);
      expect(mockCreatedParticipants[0].employeeId).toBe('emp-active-1');
      expect(mockCreatedParticipants[0].reviewCycleId).toBe(result.id);
    });

    it('accepts both Active and On Leave employees when explicitly selected', async () => {
      const dto: CreateReviewCycleDto = {
        name: 'Active and On Leave Selection',
        startDate: '2026-08-19',
        endDate: '2026-11-17',
        deadline: '2026-11-27',
        participantScope: 'SELECTED',
        participantIds: ['emp-active-1', 'emp-onleave-2'],
      };

      const result = await service.create(
        mockCompanyId,
        mockCompanyName,
        dto,
        mockUserId,
      );

      expect(result).toBeDefined();
      expect(mockCreatedParticipants).toHaveLength(2);
    });

    it('deduplicates duplicate participant IDs safely', async () => {
      const dto: CreateReviewCycleDto = {
        name: 'Deduplication Test Cycle',
        startDate: '2026-08-19',
        endDate: '2026-11-17',
        deadline: '2026-11-27',
        participantScope: 'SELECTED',
        participantIds: ['emp-active-1', 'emp-active-1', '  emp-active-1  '],
      };

      const result = await service.create(
        mockCompanyId,
        mockCompanyName,
        dto,
        mockUserId,
      );

      expect(result).toBeDefined();
      expect(mockCreatedParticipants).toHaveLength(1);
      expect(mockCreatedParticipants[0].employeeId).toBe('emp-active-1');
    });

    it('rejects SELECTED when participantIds is empty with BadRequestException', async () => {
      const dto: CreateReviewCycleDto = {
        name: 'Empty Selected Cycle',
        startDate: '2026-08-19',
        endDate: '2026-11-17',
        deadline: '2026-11-27',
        participantScope: 'SELECTED',
        participantIds: [],
      };

      await expect(
        service.create(mockCompanyId, mockCompanyName, dto, mockUserId),
      ).rejects.toThrow(BadRequestException);

      expect(mockCreatedCycles).toHaveLength(0);
      expect(mockCreatedParticipants).toHaveLength(0);
    });

    it('rejects SELECTED when nonexistent participant ID is provided', async () => {
      const dto: CreateReviewCycleDto = {
        name: 'Nonexistent ID Cycle',
        startDate: '2026-08-19',
        endDate: '2026-11-17',
        deadline: '2026-11-27',
        participantScope: 'SELECTED',
        participantIds: ['emp-active-1', 'nonexistent-ghost-id'],
      };

      await expect(
        service.create(mockCompanyId, mockCompanyName, dto, mockUserId),
      ).rejects.toThrow(BadRequestException);

      expect(mockCreatedCycles).toHaveLength(0);
      expect(mockCreatedParticipants).toHaveLength(0);
    });

    it('rejects SELECTED when cross-tenant participant ID is provided', async () => {
      const dto: CreateReviewCycleDto = {
        name: 'Cross-Tenant Attack Cycle',
        startDate: '2026-08-19',
        endDate: '2026-11-17',
        deadline: '2026-11-27',
        participantScope: 'SELECTED',
        participantIds: ['emp-cross-tenant-99'],
      };

      await expect(
        service.create(mockCompanyId, mockCompanyName, dto, mockUserId),
      ).rejects.toThrow(BadRequestException);

      expect(mockCreatedCycles).toHaveLength(0);
      expect(mockCreatedParticipants).toHaveLength(0);
    });

    it('rejects SELECTED when terminated/inactive employee is provided', async () => {
      const dto: CreateReviewCycleDto = {
        name: 'Terminated Emp Cycle',
        startDate: '2026-08-19',
        endDate: '2026-11-17',
        deadline: '2026-11-27',
        participantScope: 'SELECTED',
        participantIds: ['emp-terminated-4'],
      };

      await expect(
        service.create(mockCompanyId, mockCompanyName, dto, mockUserId),
      ).rejects.toThrow(BadRequestException);

      expect(mockCreatedCycles).toHaveLength(0);
      expect(mockCreatedParticipants).toHaveLength(0);
    });

    it('rejects SELECTED when HR Admin employee is provided per business rule', async () => {
      const dto: CreateReviewCycleDto = {
        name: 'HR Admin Cycle',
        startDate: '2026-08-19',
        endDate: '2026-11-17',
        deadline: '2026-11-27',
        participantScope: 'SELECTED',
        participantIds: ['emp-hradmin-3'],
      };

      await expect(
        service.create(mockCompanyId, mockCompanyName, dto, mockUserId),
      ).rejects.toThrow(BadRequestException);

      expect(mockCreatedCycles).toHaveLength(0);
      expect(mockCreatedParticipants).toHaveLength(0);
    });
  });

  describe('3. Date Validation & Semantic Business Rules', () => {
    it('rejects cycle when startDate is after endDate', async () => {
      const dto: CreateReviewCycleDto = {
        name: 'Invalid Date Cycle',
        startDate: '2026-11-17',
        endDate: '2026-08-19',
        deadline: '2026-11-27',
        participantScope: 'ALL',
      };

      await expect(
        service.create(mockCompanyId, mockCompanyName, dto, mockUserId),
      ).rejects.toThrow(BadRequestException);

      expect(mockCreatedCycles).toHaveLength(0);
    });

    it('rejects cycle when startDate equals endDate', async () => {
      const dto: CreateReviewCycleDto = {
        name: 'Equal Dates Cycle',
        startDate: '2026-08-19',
        endDate: '2026-08-19',
        deadline: '2026-08-25',
        participantScope: 'ALL',
      };

      await expect(
        service.create(mockCompanyId, mockCompanyName, dto, mockUserId),
      ).rejects.toThrow(BadRequestException);

      expect(mockCreatedCycles).toHaveLength(0);
    });

    it('rejects cycle when deadline is earlier than endDate', async () => {
      const dto: CreateReviewCycleDto = {
        name: 'Early Deadline Cycle',
        startDate: '2026-08-19',
        endDate: '2026-11-17',
        deadline: '2026-10-01',
        participantScope: 'ALL',
      };

      await expect(
        service.create(mockCompanyId, mockCompanyName, dto, mockUserId),
      ).rejects.toThrow(BadRequestException);

      expect(mockCreatedCycles).toHaveLength(0);
    });

    it('rejects cycle when dates are malformed', async () => {
      const dto: CreateReviewCycleDto = {
        name: 'Malformed Date Cycle',
        startDate: 'invalid-date',
        endDate: '2026-11-17',
        deadline: '2026-11-27',
        participantScope: 'ALL',
      };

      await expect(
        service.create(mockCompanyId, mockCompanyName, dto, mockUserId),
      ).rejects.toThrow(BadRequestException);

      expect(mockCreatedCycles).toHaveLength(0);
    });
  });
});


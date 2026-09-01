import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { ReviewCycleService } from './review-cycle.service';
import { ReviewCycleRepository } from '../repositories/review-cycle.repository';
import { PerformanceReviewService } from './performance-review.service';
import { PerformanceReviewRepository } from '../repositories/performance-review.repository';
import { AttendancePerformanceService } from './attendance-performance.service';
import { RatingEngineService } from './rating-engine.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

describe('Performance Phase 7 Remediation Suite (Cycle Lifecycle, Deletion, Provisioning & Manager Resolution)', () => {
  let cycleService: ReviewCycleService;
  let reviewService: PerformanceReviewService;
  let cycleRepo: any;
  let reviewRepo: any;
  let attendanceService: any;
  let prisma: any;
  let eventEmitter: any;

  const COMPANY_ID = 'comp-tenant-777';
  const USER_ID = 'usr-admin-777';

  beforeEach(async () => {
    cycleRepo = {
      findById: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
      delete: jest.fn(),
      create: jest.fn(),
    };

    reviewRepo = {
      findById: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
      createReview: jest.fn(),
      ensureDefaultCriteria: jest.fn().mockResolvedValue([
        { id: 'crit-att', name: 'Attendance', weight: 1.0 },
        { id: 'crit-qual', name: 'Quality', weight: 1.0 },
      ]),
      saveCriterionScore: jest.fn().mockResolvedValue({}),
    };

    attendanceService = {
      calculateAttendanceScore: jest.fn().mockResolvedValue(4.5),
    };

    prisma = {
      reviewCycle: {
        findFirst: jest.fn(),
        count: jest.fn(),
      },
      reviewCycleParticipant: {
        findMany: jest.fn(),
        update: jest.fn(),
        createMany: jest.fn(),
      },
      performanceReview: {
        findFirst: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
      },
      performanceCriterionScore: {
        findFirst: jest.fn(),
        upsert: jest.fn(),
      },
      employee: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
      department: {
        findUnique: jest.fn(),
      },
      performanceAudit: {
        create: jest.fn().mockResolvedValue({}),
      },
    };

    eventEmitter = {
      emit: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReviewCycleService,
        PerformanceReviewService,
        RatingEngineService,
        { provide: ReviewCycleRepository, useValue: cycleRepo },
        { provide: PerformanceReviewRepository, useValue: reviewRepo },
        { provide: AttendancePerformanceService, useValue: attendanceService },
        { provide: PrismaService, useValue: prisma },
        { provide: EventEmitter2, useValue: eventEmitter },
      ],
    }).compile();

    cycleService = module.get<ReviewCycleService>(ReviewCycleService);
    reviewService = module.get<PerformanceReviewService>(PerformanceReviewService);
  });

  // ==========================================
  // 1. STATE MACHINE TRANSITIONS (P1-2)
  // ==========================================
  describe('1. Authoritative Review Cycle State Machine Transitions (P1-2)', () => {
    const validTransitions = [
      { from: 'Draft', to: 'Scheduled' },
      { from: 'Draft', to: 'Active' },
      { from: 'Draft', to: 'Cancelled' },
      { from: 'Scheduled', to: 'Draft' },
      { from: 'Scheduled', to: 'Active' },
      { from: 'Scheduled', to: 'Cancelled' },
      { from: 'Active', to: 'Completed' },
      { from: 'Active', to: 'Cancelled' },
      { from: 'Completed', to: 'Archived' },
    ];

    validTransitions.forEach(({ from, to }) => {
      it(`ALLOWS valid transition: ${from} -> ${to}`, async () => {
        cycleRepo.findById.mockResolvedValue({
          id: 'cycle-trans',
          companyId: COMPANY_ID,
          name: 'Q3 Appraisal',
          status: from,
        });

        cycleRepo.update.mockResolvedValue({
          id: 'cycle-trans',
          status: to,
          name: 'Q3 Appraisal',
        });

        const res = await cycleService.update('cycle-trans', COMPANY_ID, { status: to }, USER_ID);
        expect(res.status).toBe(to);
        expect(cycleRepo.update).toHaveBeenCalledWith(
          'cycle-trans',
          COMPANY_ID,
          expect.objectContaining({ status: to }),
        );
      });
    });

    const invalidTransitions = [
      { from: 'Draft', to: 'Completed' },
      { from: 'Draft', to: 'Archived' },
      { from: 'Scheduled', to: 'Completed' },
      { from: 'Scheduled', to: 'Archived' },
      { from: 'Active', to: 'Draft' },
      { from: 'Active', to: 'Archived' },
      { from: 'Completed', to: 'Active' },
      { from: 'Completed', to: 'Draft' },
      { from: 'Completed', to: 'Cancelled' },
      { from: 'Archived', to: 'Active' },
      { from: 'Archived', to: 'Draft' },
      { from: 'Archived', to: 'Cancelled' },
      { from: 'Cancelled', to: 'Active' },
      { from: 'Cancelled', to: 'Draft' },
      { from: 'Cancelled', to: 'Completed' },
      { from: 'Draft', to: 'INVALID_STATUS' },
    ];

    invalidTransitions.forEach(({ from, to }) => {
      it(`REJECTS illegal transition: ${from} -> ${to}`, async () => {
        cycleRepo.findById.mockResolvedValue({
          id: 'cycle-trans',
          companyId: COMPANY_ID,
          name: 'Q3 Appraisal',
          status: from,
        });

        await expect(
          cycleService.update('cycle-trans', COMPANY_ID, { status: to }, USER_ID),
        ).rejects.toThrow(BadRequestException);

        expect(cycleRepo.update).not.toHaveBeenCalled();
      });
    });

    it('REJECTS modifying dates or metadata of an Archived or Cancelled cycle', async () => {
      cycleRepo.findById.mockResolvedValue({
        id: 'cycle-archived',
        companyId: COMPANY_ID,
        name: 'Past Cycle',
        status: 'Archived',
      });

      await expect(
        cycleService.update('cycle-archived', COMPANY_ID, { name: 'Renamed' }, USER_ID),
      ).rejects.toThrow(BadRequestException);
    });

    it('REJECTS modifying metadata of a Completed cycle unless transitioning to Archived', async () => {
      cycleRepo.findById.mockResolvedValue({
        id: 'cycle-completed',
        companyId: COMPANY_ID,
        name: 'Completed Cycle',
        status: 'Completed',
      });

      await expect(
        cycleService.update('cycle-completed', COMPANY_ID, { name: 'Renamed' }, USER_ID),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ==========================================
  // 2. CYCLE DELETION PROTECTION (P1-3)
  // ==========================================
  describe('2. Cycle Deletion Protection & Cascade Prevention (P1-3)', () => {
    it('REJECTS deletion of an Active cycle', async () => {
      cycleRepo.findById.mockResolvedValue({
        id: 'cycle-active',
        companyId: COMPANY_ID,
        name: 'Active Cycle',
        status: 'Active',
      });

      await expect(cycleService.delete('cycle-active', COMPANY_ID)).rejects.toThrow(
        BadRequestException,
      );
      expect(cycleRepo.delete).not.toHaveBeenCalled();
    });

    it('REJECTS deletion of a Completed cycle', async () => {
      cycleRepo.findById.mockResolvedValue({
        id: 'cycle-comp',
        companyId: COMPANY_ID,
        name: 'Completed Cycle',
        status: 'Completed',
      });

      await expect(cycleService.delete('cycle-comp', COMPANY_ID)).rejects.toThrow(
        BadRequestException,
      );
      expect(cycleRepo.delete).not.toHaveBeenCalled();
    });

    it('REJECTS deletion of an Archived cycle', async () => {
      cycleRepo.findById.mockResolvedValue({
        id: 'cycle-arch',
        companyId: COMPANY_ID,
        name: 'Archived Cycle',
        status: 'Archived',
      });

      await expect(cycleService.delete('cycle-arch', COMPANY_ID)).rejects.toThrow(
        BadRequestException,
      );
      expect(cycleRepo.delete).not.toHaveBeenCalled();
    });

    it('REJECTS deletion of ANY cycle that has provisioned performance reviews', async () => {
      cycleRepo.findById.mockResolvedValue({
        id: 'cycle-draft-with-reviews',
        companyId: COMPANY_ID,
        name: 'Draft with reviews',
        status: 'Draft',
      });

      prisma.performanceReview.count.mockResolvedValue(15);

      await expect(
        cycleService.delete('cycle-draft-with-reviews', COMPANY_ID),
      ).rejects.toThrow(BadRequestException);
      expect(cycleRepo.delete).not.toHaveBeenCalled();
    });

    it('ALLOWS deletion of an unlaunched Draft cycle with 0 reviews', async () => {
      cycleRepo.findById.mockResolvedValue({
        id: 'cycle-empty-draft',
        companyId: COMPANY_ID,
        name: 'Empty Draft',
        status: 'Draft',
      });

      prisma.performanceReview.count.mockResolvedValue(0);
      cycleRepo.delete.mockResolvedValue({ id: 'cycle-empty-draft', name: 'Empty Draft' });

      const res = await cycleService.delete('cycle-empty-draft', COMPANY_ID);
      expect(res.id).toBe('cycle-empty-draft');
      expect(cycleRepo.delete).toHaveBeenCalledWith('cycle-empty-draft', COMPANY_ID);
    });
  });

  // ==========================================
  // 3. PROVISIONING STATUS GATE (P2-1)
  // ==========================================
  describe('3. Provisioning Cycle Status Gate (P2-1)', () => {
    it('REJECTS review provisioning for a Completed cycle', async () => {
      prisma.reviewCycle.findFirst.mockResolvedValue({
        id: 'cycle-c-1',
        companyId: COMPANY_ID,
        status: 'Completed',
      });

      await expect(
        reviewService.createReviewsForCycle(COMPANY_ID, 'Company', 'cycle-c-1', USER_ID),
      ).rejects.toThrow(BadRequestException);

      expect(reviewRepo.createReview).not.toHaveBeenCalled();
    });

    it('REJECTS review provisioning for an Archived or Cancelled cycle', async () => {
      prisma.reviewCycle.findFirst.mockResolvedValue({
        id: 'cycle-c-2',
        companyId: COMPANY_ID,
        status: 'Archived',
      });

      await expect(
        reviewService.createReviewsForCycle(COMPANY_ID, 'Company', 'cycle-c-2', USER_ID),
      ).rejects.toThrow(BadRequestException);

      expect(reviewRepo.createReview).not.toHaveBeenCalled();
    });

    it('ALLOWS review provisioning for a Draft or Active cycle', async () => {
      prisma.reviewCycle.findFirst.mockResolvedValue({
        id: 'cycle-active-prov',
        companyId: COMPANY_ID,
        status: 'Active',
        startDate: '2026-01-01',
        endDate: '2026-03-31',
      });

      prisma.reviewCycleParticipant.findMany.mockResolvedValue([
        {
          id: 'part-1',
          employee: { id: 'emp-1', managerId: null, departmentId: null },
        },
      ]);

      prisma.performanceReview.findFirst.mockResolvedValue(null);
      reviewRepo.createReview.mockResolvedValue({ id: 'rev-prov-1' });
      reviewRepo.update.mockResolvedValue({ id: 'rev-prov-1', attendanceRating: 4.5 });

      const created = await reviewService.createReviewsForCycle(
        COMPANY_ID,
        'Company',
        'cycle-active-prov',
        USER_ID,
      );

      expect(created.length).toBe(1);
      expect(reviewRepo.createReview).toHaveBeenCalled();
    });
  });

  // ==========================================
  // 4. DATABASE UNIQUENESS & CONCURRENCY RACE (P1-1)
  // ==========================================
  describe('4. Concurrency Race & Database Uniqueness Handling (P1-1)', () => {
    it('gracefully recovers when database throws unique constraint violation (P2002) during race', async () => {
      prisma.reviewCycle.findFirst.mockResolvedValue({
        id: 'cycle-race',
        companyId: COMPANY_ID,
        status: 'Active',
        startDate: '2026-01-01',
        endDate: '2026-03-31',
      });

      prisma.reviewCycleParticipant.findMany.mockResolvedValue([
        {
          id: 'part-race-1',
          employee: { id: 'emp-race-1', managerId: null, departmentId: null },
        },
      ]);

      // First check returned null (race condition)
      prisma.performanceReview.findFirst.mockResolvedValue(null);

      // createReview throws Prisma P2002 unique constraint error because concurrent worker created it
      const p2002Error: any = new Error('Unique constraint failed on the fields: (`reviewCycleId`,`employeeId`)');
      p2002Error.code = 'P2002';
      reviewRepo.createReview.mockRejectedValue(p2002Error);

      // Service should catch P2002 and mark participant as Provisioned without 500 error
      const created = await reviewService.createReviewsForCycle(
        COMPANY_ID,
        'Company',
        'cycle-race',
        USER_ID,
      );

      expect(created.length).toBe(0);
      expect(prisma.reviewCycleParticipant.update).toHaveBeenCalledWith({
        where: { id: 'part-race-1' },
        data: { status: 'Provisioned' },
      });
    });
  });

  // ==========================================
  // 5. MANAGER RESOLUTION HARDENING (P2-2)
  // ==========================================
  describe('5. Manager Resolution & Hierarchy Protection (P2-2)', () => {
    it('PROHIBITS self-assignment when employee.managerId === employee.id', async () => {
      prisma.reviewCycle.findFirst.mockResolvedValue({
        id: 'cycle-mgr',
        companyId: COMPANY_ID,
        status: 'Active',
        startDate: '2026-01-01',
        endDate: '2026-03-31',
      });

      prisma.reviewCycleParticipant.findMany.mockResolvedValue([
        {
          id: 'part-self-mgr',
          employee: { id: 'emp-dan', managerId: 'emp-dan', departmentId: null },
        },
      ]);

      prisma.performanceReview.findFirst.mockResolvedValue(null);
      reviewRepo.createReview.mockResolvedValue({ id: 'rev-dan' });
      reviewRepo.update.mockResolvedValue({ id: 'rev-dan' });

      await reviewService.createReviewsForCycle(COMPANY_ID, 'Company', 'cycle-mgr', USER_ID);

      // Must NOT assign self as manager (managerId must be null)
      expect(reviewRepo.createReview).toHaveBeenCalledWith(
        COMPANY_ID,
        'Company',
        expect.objectContaining({
          employeeId: 'emp-dan',
          managerId: null,
        }),
      );
    });

    it('IGNORES terminated, resigned, or soft-deleted direct manager and falls back safely', async () => {
      prisma.reviewCycle.findFirst.mockResolvedValue({
        id: 'cycle-mgr-term',
        companyId: COMPANY_ID,
        status: 'Active',
        startDate: '2026-01-01',
        endDate: '2026-03-31',
      });

      prisma.reviewCycleParticipant.findMany.mockResolvedValue([
        {
          id: 'part-term-mgr',
          employee: { id: 'emp-dan', managerId: 'emp-term-mgr', departmentId: null },
        },
      ]);

      // Direct manager lookup returns null because status is Terminated/Deleted
      prisma.employee.findFirst.mockResolvedValue(null);

      prisma.performanceReview.findFirst.mockResolvedValue(null);
      reviewRepo.createReview.mockResolvedValue({ id: 'rev-dan-2' });
      reviewRepo.update.mockResolvedValue({ id: 'rev-dan-2' });

      await reviewService.createReviewsForCycle(COMPANY_ID, 'Company', 'cycle-mgr-term', USER_ID);

      expect(reviewRepo.createReview).toHaveBeenCalledWith(
        COMPANY_ID,
        'Company',
        expect.objectContaining({
          employeeId: 'emp-dan',
          managerId: null,
        }),
      );
    });

    it('ACCEPTS valid Active or On Leave manager belonging to the same tenant', async () => {
      prisma.reviewCycle.findFirst.mockResolvedValue({
        id: 'cycle-mgr-valid',
        companyId: COMPANY_ID,
        status: 'Active',
        startDate: '2026-01-01',
        endDate: '2026-03-31',
      });

      prisma.reviewCycleParticipant.findMany.mockResolvedValue([
        {
          id: 'part-valid-mgr',
          employee: { id: 'emp-dan', managerId: 'emp-active-mgr', departmentId: null },
        },
      ]);

      prisma.employee.findFirst.mockResolvedValue({
        id: 'emp-active-mgr',
        companyId: COMPANY_ID,
        status: 'On Leave',
        deletedAt: null,
      });

      prisma.performanceReview.findFirst.mockResolvedValue(null);
      reviewRepo.createReview.mockResolvedValue({ id: 'rev-dan-3' });
      reviewRepo.update.mockResolvedValue({ id: 'rev-dan-3' });

      await reviewService.createReviewsForCycle(COMPANY_ID, 'Company', 'cycle-mgr-valid', USER_ID);

      expect(reviewRepo.createReview).toHaveBeenCalledWith(
        COMPANY_ID,
        'Company',
        expect.objectContaining({
          employeeId: 'emp-dan',
          managerId: 'emp-active-mgr',
        }),
      );
    });

    it('Department-head fallback: assigns department head if active and not self', async () => {
      prisma.reviewCycle.findFirst.mockResolvedValue({
        id: 'cycle-dept-head',
        companyId: COMPANY_ID,
        status: 'Active',
        startDate: '2026-01-01',
        endDate: '2026-03-31',
      });

      prisma.reviewCycleParticipant.findMany.mockResolvedValue([
        {
          id: 'part-dept-head',
          employee: { id: 'emp-dan', managerId: null, departmentId: 'dept-eng' },
        },
      ]);

      prisma.department.findUnique.mockResolvedValue({
        id: 'dept-eng',
        head: 'Director Sarah',
      });

      prisma.employee.findFirst.mockResolvedValue({
        id: 'emp-sarah',
        name: 'Director Sarah',
        companyId: COMPANY_ID,
        status: 'Active',
        deletedAt: null,
      });

      prisma.performanceReview.findFirst.mockResolvedValue(null);
      reviewRepo.createReview.mockResolvedValue({ id: 'rev-dan-4' });
      reviewRepo.update.mockResolvedValue({ id: 'rev-dan-4' });

      await reviewService.createReviewsForCycle(COMPANY_ID, 'Company', 'cycle-dept-head', USER_ID);

      expect(reviewRepo.createReview).toHaveBeenCalledWith(
        COMPANY_ID,
        'Company',
        expect.objectContaining({
          employeeId: 'emp-dan',
          managerId: 'emp-sarah',
        }),
      );
    });

    it('Department-head fallback: leaves manager null if department head is the employee themselves', async () => {
      prisma.reviewCycle.findFirst.mockResolvedValue({
        id: 'cycle-self-head',
        companyId: COMPANY_ID,
        status: 'Active',
        startDate: '2026-01-01',
        endDate: '2026-03-31',
      });

      prisma.reviewCycleParticipant.findMany.mockResolvedValue([
        {
          id: 'part-self-head',
          employee: { id: 'emp-sarah', managerId: null, departmentId: 'dept-eng' },
        },
      ]);

      prisma.department.findUnique.mockResolvedValue({
        id: 'dept-eng',
        head: 'Director Sarah',
      });

      // Returns same employee ID as the reviewee
      prisma.employee.findFirst.mockResolvedValue({
        id: 'emp-sarah',
        name: 'Director Sarah',
        companyId: COMPANY_ID,
        status: 'Active',
        deletedAt: null,
      });

      prisma.performanceReview.findFirst.mockResolvedValue(null);
      reviewRepo.createReview.mockResolvedValue({ id: 'rev-sarah' });
      reviewRepo.update.mockResolvedValue({ id: 'rev-sarah' });

      await reviewService.createReviewsForCycle(COMPANY_ID, 'Company', 'cycle-self-head', USER_ID);

      expect(reviewRepo.createReview).toHaveBeenCalledWith(
        COMPANY_ID,
        'Company',
        expect.objectContaining({
          employeeId: 'emp-sarah',
          managerId: null,
        }),
      );
    });
  });
});

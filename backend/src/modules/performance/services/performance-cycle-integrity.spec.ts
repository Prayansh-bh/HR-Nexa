import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ReviewCycleService } from './review-cycle.service';
import { ReviewCycleRepository } from '../repositories/review-cycle.repository';
import { PerformanceReviewService } from './performance-review.service';
import { PerformanceReviewRepository } from '../repositories/performance-review.repository';
import { AttendancePerformanceService } from './attendance-performance.service';
import { RatingEngineService } from './rating-engine.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

describe('Performance Cycle Integrity, Temporal & State Authorization Suite (Performance Phase 6)', () => {
  let cycleService: ReviewCycleService;
  let reviewService: PerformanceReviewService;
  let cycleRepo: any;
  let reviewRepo: any;
  let prisma: any;
  let eventEmitter: any;

  const COMPANY_ID = 'comp-tenant-alpha';
  const USER_ID = 'usr-admin-1';

  const mockEmployeeMeta = {
    userId: 'usr-emp-1',
    userName: 'Employee Bob',
    role: 'Employee',
    ip: '127.0.0.1',
    userAgent: 'Jest',
  };

  const mockManagerMeta = {
    userId: 'usr-mgr-1',
    userName: 'Manager Alice',
    role: 'Manager',
    ip: '127.0.0.1',
    userAgent: 'Jest',
  };

  const mockHrMeta = {
    userId: 'usr-hr-1',
    userName: 'HR Admin Carol',
    role: 'HRAdmin',
    ip: '127.0.0.1',
    userAgent: 'Jest',
  };

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
      saveCriterionScore: jest.fn(),
    };

    prisma = {
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
        { provide: AttendancePerformanceService, useValue: {} },
        { provide: PrismaService, useValue: prisma },
        { provide: EventEmitter2, useValue: eventEmitter },
      ],
    }).compile();

    cycleService = module.get<ReviewCycleService>(ReviewCycleService);
    reviewService = module.get<PerformanceReviewService>(PerformanceReviewService);
  });

  // ==========================================
  // 1. CYCLE DATE INTEGRITY & STATUS TRANSITIONS
  // ==========================================
  describe('1. Cycle Date Integrity & Validation upon Update', () => {
    it('should reject update if startDate is greater than or equal to endDate', async () => {
      cycleRepo.findById.mockResolvedValue({
        id: 'cycle-1',
        companyId: COMPANY_ID,
        startDate: '2026-01-01',
        endDate: '2026-03-31',
        deadline: '2026-04-15',
        status: 'Active',
      });

      await expect(
        cycleService.update(
          'cycle-1',
          COMPANY_ID,
          { startDate: '2026-05-01', endDate: '2026-03-31' },
          USER_ID,
        ),
      ).rejects.toThrow(BadRequestException);

      expect(cycleRepo.update).not.toHaveBeenCalled();
    });

    it('should reject update if deadline is earlier than endDate', async () => {
      cycleRepo.findById.mockResolvedValue({
        id: 'cycle-1',
        companyId: COMPANY_ID,
        startDate: '2026-01-01',
        endDate: '2026-03-31',
        deadline: '2026-04-15',
        status: 'Active',
      });

      await expect(
        cycleService.update(
          'cycle-1',
          COMPANY_ID,
          { deadline: '2026-02-01' },
          USER_ID,
        ),
      ).rejects.toThrow(BadRequestException);

      expect(cycleRepo.update).not.toHaveBeenCalled();
    });

    it('should successfully update cycle when dates and status are valid', async () => {
      cycleRepo.findById.mockResolvedValue({
        id: 'cycle-1',
        companyId: COMPANY_ID,
        name: 'Q1 Review',
        startDate: '2026-01-01',
        endDate: '2026-03-31',
        deadline: '2026-04-15',
        status: 'Active',
      });

      cycleRepo.update.mockResolvedValue({
        id: 'cycle-1',
        status: 'Completed',
        name: 'Q1 Review Finalized',
      });

      const res = await cycleService.update(
        'cycle-1',
        COMPANY_ID,
        { status: 'Completed', name: 'Q1 Review Finalized' },
        USER_ID,
      );

      expect(res.status).toBe('Completed');
      expect(cycleRepo.update).toHaveBeenCalled();
    });
  });

  // ==========================================
  // 2. REVIEW MUTATION VS CYCLE STATE AUTHORIZATION
  // ==========================================
  describe('2. Review Mutation vs Parent Cycle State Enforcement', () => {
    it('submitSelfReview: should reject self-review submission if parent cycle is Completed', async () => {
      reviewRepo.findById.mockResolvedValue({
        id: 'rev-c-1',
        companyId: COMPANY_ID,
        employeeId: 'emp-bob',
        status: 'Draft',
        reviewCycle: { id: 'cycle-c-1', status: 'Completed' },
        scores: [],
      });

      await expect(
        reviewService.submitSelfReview(
          'rev-c-1',
          COMPANY_ID,
          'emp-bob',
          'Self appraisal',
          [],
          mockEmployeeMeta,
        ),
      ).rejects.toThrow(BadRequestException);

      expect(reviewRepo.update).not.toHaveBeenCalled();
    });

    it('submitSelfReview: should reject self-review submission if parent cycle is Archived or Cancelled', async () => {
      reviewRepo.findById.mockResolvedValue({
        id: 'rev-c-2',
        companyId: COMPANY_ID,
        employeeId: 'emp-bob',
        status: 'Draft',
        reviewCycle: { id: 'cycle-c-2', status: 'Archived' },
        scores: [],
      });

      await expect(
        reviewService.submitSelfReview(
          'rev-c-2',
          COMPANY_ID,
          'emp-bob',
          'Self appraisal',
          [],
          mockEmployeeMeta,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('submitManagerReview: should reject manager evaluation if parent cycle is Completed', async () => {
      reviewRepo.findById.mockResolvedValue({
        id: 'rev-m-1',
        companyId: COMPANY_ID,
        employeeId: 'emp-bob',
        managerId: 'emp-alice',
        status: 'Self Review',
        reviewCycle: { id: 'cycle-m-1', status: 'Completed' },
        scores: [],
      });

      await expect(
        reviewService.submitManagerReview(
          'rev-m-1',
          COMPANY_ID,
          'emp-alice',
          'Manager assessment',
          { promotion: false, increment: false, training: false },
          [],
          mockManagerMeta,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('overrideHrReview: should reject HR calibration override if parent cycle is Cancelled', async () => {
      reviewRepo.findById.mockResolvedValue({
        id: 'rev-hr-1',
        companyId: COMPANY_ID,
        employeeId: 'emp-bob',
        status: 'Manager Review',
        reviewCycle: { id: 'cycle-hr-1', status: 'Cancelled' },
        scores: [],
      });

      await expect(
        reviewService.overrideHrReview(
          'rev-hr-1',
          COMPANY_ID,
          'HR calibration',
          [],
          mockHrMeta,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });
});

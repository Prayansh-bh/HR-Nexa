import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PerformanceReviewService } from './performance-review.service';
import { PerformanceReviewRepository } from '../repositories/performance-review.repository';
import { AttendancePerformanceService } from './attendance-performance.service';
import { RatingEngineService } from './rating-engine.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

describe('PerformanceReviewService — Recommendation Persistence & Visibility Suite (Performance Phase 2)', () => {
  let service: PerformanceReviewService;
  let repository: any;
  let attendanceService: any;
  let ratingEngine: RatingEngineService;
  let prisma: any;
  let eventEmitter: any;

  const COMPANY_ID = 'comp-tenant-alpha';

  const mockManagerMeta = {
    userId: 'usr-mgr-1',
    userName: 'Manager Bob',
    role: 'Manager',
    ip: '127.0.0.1',
    userAgent: 'Jest',
  };

  const mockEmployeeMeta = {
    userId: 'usr-emp-1',
    userName: 'Employee Charlie',
    role: 'Employee',
    ip: '127.0.0.1',
    userAgent: 'Jest',
  };

  const mockHrMeta = {
    userId: 'usr-hr-1',
    userName: 'HR Alice',
    role: 'HRAdmin',
    ip: '127.0.0.1',
    userAgent: 'Jest',
  };

  beforeEach(async () => {
    repository = {
      findById: jest.fn(),
      update: jest.fn(),
      saveCriterionScore: jest.fn(),
    };

    attendanceService = {
      calculateAttendanceScore: jest.fn().mockResolvedValue(4.5),
    };

    ratingEngine = new RatingEngineService();

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
        PerformanceReviewService,
        { provide: PerformanceReviewRepository, useValue: repository },
        { provide: AttendancePerformanceService, useValue: attendanceService },
        { provide: RatingEngineService, useValue: ratingEngine },
        { provide: PrismaService, useValue: prisma },
        { provide: EventEmitter2, useValue: eventEmitter },
      ],
    }).compile();

    service = module.get<PerformanceReviewService>(PerformanceReviewService);
  });

  // ==========================================
  // 1. RECOMMENDATION PERSISTENCE
  // ==========================================
  describe('1. Persistence of Promotion, Increment, and Training Recommendations', () => {
    it('should persist all 3 recommendation booleans to database upon manager review submission', async () => {
      const existingReview = {
        id: 'rev-001',
        companyId: COMPANY_ID,
        employeeId: 'emp-direct-report',
        managerId: 'emp-mgr-bob',
        status: 'Self Review',
        scores: [
          { criterionId: 'crit-1', criterion: { name: 'Quality', weight: 1.0 }, managerScore: 4.0 },
        ],
      };

      repository.findById.mockResolvedValue(existingReview);
      repository.update.mockImplementation((id: string, data: any) => ({
        ...existingReview,
        ...data,
      }));

      const result = await service.submitManagerReview(
        'rev-001',
        COMPANY_ID,
        'emp-mgr-bob',
        'Exceptional performer throughout this cycle.',
        {
          promotion: true,
          increment: true,
          training: false,
        },
        [{ criterionId: 'crit-1', score: 4.5, remarks: 'Exceeds goals' }],
        mockManagerMeta,
      );

      // Verify repository update includes explicit recommendation fields
      expect(repository.update).toHaveBeenCalledWith(
        'rev-001',
        expect.objectContaining({
          status: 'Manager Review',
          managerFeedback: 'Exceptional performer throughout this cycle.',
          promotionRecommended: true,
          incrementRecommended: true,
          trainingRecommended: false,
        }),
      );

      // Verify audit logging captures recommendation metadata
      expect(prisma.performanceAudit.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            companyId: COMPANY_ID,
            action: 'Manager Review Submitted',
            newValue: expect.stringContaining('"promotion":true'),
          }),
        }),
      );

      expect(result.promotionRecommended).toBe(true);
      expect(result.incrementRecommended).toBe(true);
      expect(result.trainingRecommended).toBe(false);
    });
  });

  // ==========================================
  // 2. AUTHORIZATION & PEER TAMPERING GUARDS
  // ==========================================
  describe('2. Authorization & Peer Submission Guards', () => {
    it('should prohibit self-evaluation by manager on their own appraisal', async () => {
      repository.findById.mockResolvedValue({
        id: 'rev-mgr-self',
        companyId: COMPANY_ID,
        employeeId: 'emp-mgr-bob',
        managerId: 'emp-director-eve',
        status: 'Self Review',
        scores: [],
      });

      await expect(
        service.submitManagerReview(
          'rev-mgr-self',
          COMPANY_ID,
          'emp-mgr-bob',
          'Attempting self manager assessment',
          { promotion: true, increment: true, training: false },
          [],
          mockManagerMeta,
        ),
      ).rejects.toThrow(ForbiddenException);

      expect(repository.update).not.toHaveBeenCalled();
    });

    it('should throw 404 NotFoundException if non-manager employee attempts to submit manager review on a peer', async () => {
      repository.findById.mockResolvedValue({
        id: 'rev-peer',
        companyId: COMPANY_ID,
        employeeId: 'emp-alice',
        managerId: 'emp-mgr-bob',
        status: 'Self Review',
        scores: [],
      });

      // Employee Charlie tries to submit manager review for Alice
      await expect(
        service.submitManagerReview(
          'rev-peer',
          COMPANY_ID,
          'emp-charlie',
          'Peer attempting unauthorized manager assessment',
          { promotion: true, increment: true, training: false },
          [],
          mockEmployeeMeta,
        ),
      ).rejects.toThrow(NotFoundException);

      expect(repository.update).not.toHaveBeenCalled();
    });

    it('should throw 404 NotFoundException if manager attempts to submit review for an employee they do not manage', async () => {
      repository.findById.mockResolvedValue({
        id: 'rev-other-team',
        companyId: COMPANY_ID,
        employeeId: 'emp-alice',
        managerId: 'emp-other-manager',
        status: 'Self Review',
        scores: [],
      });

      await expect(
        service.submitManagerReview(
          'rev-other-team',
          COMPANY_ID,
          'emp-mgr-bob',
          'Unmanaged employee review attempt',
          { promotion: true, increment: true, training: false },
          [],
          mockManagerMeta,
        ),
      ).rejects.toThrow(NotFoundException);

      expect(repository.update).not.toHaveBeenCalled();
    });

    it('should allow HRAdmin to submit manager review on behalf of department', async () => {
      repository.findById.mockResolvedValue({
        id: 'rev-hr-override',
        companyId: COMPANY_ID,
        employeeId: 'emp-alice',
        managerId: 'emp-mgr-bob',
        status: 'Self Review',
        scores: [],
      });

      repository.update.mockResolvedValue({ id: 'rev-hr-override', status: 'Manager Review' });

      await service.submitManagerReview(
        'rev-hr-override',
        COMPANY_ID,
        'emp-hr-1',
        'HR Admin executive assessment',
        { promotion: true, increment: false, training: true },
        [],
        mockHrMeta,
      );

      expect(repository.update).toHaveBeenCalledWith(
        'rev-hr-override',
        expect.objectContaining({
          promotionRecommended: true,
          incrementRecommended: false,
          trainingRecommended: true,
        }),
      );
    });
  });

  // ==========================================
  // 3. LIFECYCLE IMMUTABILITY & PERSISTENCE PRESERVATION
  // ==========================================
  describe('3. Lifecycle State Machine & Immutability', () => {
    it('should reject manager review submission when status is already Manager Review or HR Review', async () => {
      repository.findById.mockResolvedValue({
        id: 'rev-already-submitted',
        companyId: COMPANY_ID,
        employeeId: 'emp-alice',
        managerId: 'emp-mgr-bob',
        status: 'Manager Review',
        scores: [],
      });

      await expect(
        service.submitManagerReview(
          'rev-already-submitted',
          COMPANY_ID,
          'emp-mgr-bob',
          'Attempting duplicate manager assessment',
          { promotion: true, increment: true, training: false },
          [],
          mockManagerMeta,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject manager review submission on Completed or Archived reviews', async () => {
      repository.findById.mockResolvedValue({
        id: 'rev-completed',
        companyId: COMPANY_ID,
        employeeId: 'emp-alice',
        managerId: 'emp-mgr-bob',
        status: 'Completed',
        scores: [],
      });

      await expect(
        service.submitManagerReview(
          'rev-completed',
          COMPANY_ID,
          'emp-mgr-bob',
          'Attempting modification on finalized review',
          { promotion: true, increment: true, training: false },
          [],
          mockManagerMeta,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('HR Calibration Override: should preserve manager recommendations without nullifying them', async () => {
      const reviewWithRecommendations = {
        id: 'rev-calibration',
        companyId: COMPANY_ID,
        employeeId: 'emp-alice',
        managerId: 'emp-mgr-bob',
        status: 'Manager Review',
        promotionRecommended: true,
        incrementRecommended: true,
        trainingRecommended: false,
        finalRating: 3.5,
        scores: [
          {
            criterionId: 'crit-att',
            criterion: { id: 'crit-att', name: 'Attendance', weight: 1.0 },
            hrScore: 4.0,
            managerScore: 4.0,
            selfScore: 4.0,
            remarks: '',
          },
        ],
      };

      repository.findById.mockResolvedValue(reviewWithRecommendations);
      repository.update.mockResolvedValue({
        ...reviewWithRecommendations,
        status: 'HR Review',
        hrRemarks: 'Calibration complete',
      });

      await service.overrideHrReview(
        'rev-calibration',
        COMPANY_ID,
        'Calibration complete',
        [{ criterionId: 'crit-att', score: 4.5, remarks: 'HR adjusted' }],
        mockHrMeta,
      );

      // Verify update does NOT wipe recommendation fields
      expect(repository.update).toHaveBeenCalledWith(
        'rev-calibration',
        expect.not.objectContaining({
          promotionRecommended: expect.anything(),
          incrementRecommended: expect.anything(),
          trainingRecommended: expect.anything(),
        }),
      );
    });

    it('Review Completion: Completed reviews are strictly immutable and retain recommendations', async () => {
      const finalizedReview = {
        id: 'rev-final',
        companyId: COMPANY_ID,
        employeeId: 'emp-alice',
        managerId: 'emp-mgr-bob',
        status: 'Completed',
        promotionRecommended: true,
        incrementRecommended: true,
        trainingRecommended: false,
        finalRating: 4.8,
        scores: [],
      };

      repository.findById.mockResolvedValue(finalizedReview);

      const res = await service.completeReview('rev-final', COMPANY_ID, mockHrMeta);

      expect(res.promotionRecommended).toBe(true);
      expect(res.incrementRecommended).toBe(true);
      expect(res.trainingRecommended).toBe(false);
      expect(repository.update).not.toHaveBeenCalled();
    });
  });

  // ==========================================
  // 4. TENANT ISOLATION
  // ==========================================
  describe('4. Tenant Isolation in Recommendations', () => {
    it('should prevent Tenant A manager from submitting recommendations on Tenant B review', async () => {
      // findById returns null because companyId does not match Tenant B
      repository.findById.mockResolvedValue(null);

      await expect(
        service.submitManagerReview(
          'rev-tenant-b-001',
          COMPANY_ID,
          'emp-mgr-bob',
          'Cross-tenant submission attempt',
          { promotion: true, increment: true, training: false },
          [],
          mockManagerMeta,
        ),
      ).rejects.toThrow(NotFoundException);

      expect(repository.findById).toHaveBeenCalledWith('rev-tenant-b-001', COMPANY_ID);
      expect(repository.update).not.toHaveBeenCalled();
    });
  });
});

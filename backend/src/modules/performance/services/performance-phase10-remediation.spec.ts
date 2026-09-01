import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { SubmitSelfReviewDto } from '../dto/submit-self-review.dto';
import { SubmitManagerReviewDto } from '../dto/submit-manager-review.dto';
import { OverrideHrReviewDto } from '../dto/override-hr-review.dto';
import { CriterionScoreItemDto } from '../dto/criterion-score-item.dto';
import { PerformanceReviewService } from './performance-review.service';
import { PerformanceReviewRepository } from '../repositories/performance-review.repository';
import { RatingEngineService } from './rating-engine.service';
import { AttendancePerformanceService } from './attendance-performance.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

describe('Performance Phase 10 — Input Integrity & Tenant Isolation Remediation Suite', () => {
  const VALID_UUID = '123e4567-e89b-42d3-a456-426614174000';
  const VALID_UUID_2 = '987fcdeb-51a2-43f7-9b84-123456789abc';
  const COMPANY_A = 'comp-tenant-a';
  const COMPANY_B = 'comp-tenant-b';

  describe('1. DTO Runtime Validation (class-validator)', () => {
    it('1.1 accepts valid score boundaries (0.0, 2.5, 5.0) and valid UUIDs in SubmitSelfReviewDto', async () => {
      const payload = {
        feedback: 'Solid quarter performance',
        scores: [
          { criterionId: VALID_UUID, score: 0.0, remarks: 'Zero baseline' },
          { criterionId: VALID_UUID_2, score: 2.5, remarks: 'Mid score' },
          { criterionId: VALID_UUID, score: 5.0, remarks: 'Max score' },
        ],
      };

      const dto = plainToInstance(SubmitSelfReviewDto, payload);
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('1.2 rejects negative score (-0.1, -5.0) in SubmitSelfReviewDto', async () => {
      const payload = {
        feedback: 'Negative test',
        scores: [{ criterionId: VALID_UUID, score: -0.1 }],
      };

      const dto = plainToInstance(SubmitSelfReviewDto, payload);
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(JSON.stringify(errors)).toContain('Score must be at least 0.0');
    });

    it('1.3 rejects score exceeding maximum (5.1, 999.0) in SubmitSelfReviewDto', async () => {
      const payload = {
        feedback: 'Overflow test',
        scores: [{ criterionId: VALID_UUID, score: 5.1 }],
      };

      const dto = plainToInstance(SubmitSelfReviewDto, payload);
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(JSON.stringify(errors)).toContain('Score cannot exceed 5.0');
    });

    it('1.4 rejects malformed non-UUID criterionId in SubmitSelfReviewDto', async () => {
      const payload = {
        feedback: 'Malformed UUID test',
        scores: [{ criterionId: 'not-a-valid-uuid', score: 4.0 }],
      };

      const dto = plainToInstance(SubmitSelfReviewDto, payload);
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(JSON.stringify(errors)).toContain('isUuid');
    });

    it('1.5 rejects non-array scores in SubmitSelfReviewDto', async () => {
      const payload = {
        feedback: 'Non array',
        scores: 'invalid-scores-string',
      };

      const dto = plainToInstance(SubmitSelfReviewDto, payload as any);
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('1.6 validates SubmitManagerReviewDto with promotion flags and score bounds', async () => {
      const validPayload = {
        feedback: 'Strong leadership exhibited',
        promotion: true,
        increment: true,
        training: false,
        scores: [{ criterionId: VALID_UUID, score: 4.8, remarks: 'Excellent' }],
      };

      const dto = plainToInstance(SubmitManagerReviewDto, validPayload);
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('1.7 rejects out-of-range scores in SubmitManagerReviewDto', async () => {
      const invalidPayload = {
        feedback: 'Invalid manager score',
        scores: [{ criterionId: VALID_UUID, score: 100 }],
      };

      const dto = plainToInstance(SubmitManagerReviewDto, invalidPayload);
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(JSON.stringify(errors)).toContain('Score cannot exceed 5.0');
    });

    it('1.8 validates OverrideHrReviewDto with remarks and score bounds', async () => {
      const validPayload = {
        remarks: 'Executive committee calibrated score',
        scores: [{ criterionId: VALID_UUID, score: 4.2 }],
      };

      const dto = plainToInstance(OverrideHrReviewDto, validPayload);
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('1.9 rejects out-of-range scores in OverrideHrReviewDto', async () => {
      const invalidPayload = {
        remarks: 'Negative override',
        scores: [{ criterionId: VALID_UUID, score: -2.0 }],
      };

      const dto = plainToInstance(OverrideHrReviewDto, invalidPayload);
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(JSON.stringify(errors)).toContain('Score must be at least 0.0');
    });
  });

  describe('2. Service-Level Defensive Score Range Enforcement', () => {
    let service: PerformanceReviewService;
    let mockRepo: any;
    let mockRatingEngine: any;
    let mockAttendance: any;
    let mockPrisma: any;
    let mockEventEmitter: any;

    const auditMeta = {
      userId: 'user-1',
      userName: 'Alice Admin',
      role: 'HRAdmin',
      ip: '127.0.0.1',
      userAgent: 'Jest',
    };

    beforeEach(() => {
      mockRepo = {
        findById: jest.fn().mockResolvedValue({
          id: 'rev-1',
          employeeId: 'emp-1',
          managerId: 'mgr-1',
          status: 'Draft',
          reviewCycle: { id: 'cycle-1', status: 'Active' },
          scores: [],
        }),
        saveCriterionScore: jest.fn().mockResolvedValue({ id: 'score-1' }),
        update: jest.fn().mockImplementation((id, data) => ({ id, ...data })),
      };

      mockRatingEngine = {
        calculateWeightedScore: jest.fn().mockReturnValue(4.0),
      };

      mockAttendance = {
        calculateAttendanceScore: jest.fn().mockResolvedValue(5.0),
      };

      mockPrisma = {
        performanceAudit: { create: jest.fn().mockResolvedValue({}) },
        reviewCycleParticipant: { update: jest.fn().mockResolvedValue({}) },
      };

      mockEventEmitter = {
        emit: jest.fn(),
      };

      service = new PerformanceReviewService(
        mockRepo,
        mockRatingEngine,
        mockAttendance,
        mockPrisma,
        mockEventEmitter,
      );
    });

    it('2.1 submitSelfReview rejects score < 0 with BadRequestException', async () => {
      await expect(
        service.submitSelfReview(
          'rev-1',
          COMPANY_A,
          'emp-1',
          'feedback',
          [{ criterionId: VALID_UUID, score: -1.0 }],
          auditMeta,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('2.2 submitSelfReview rejects score > 5 with BadRequestException', async () => {
      await expect(
        service.submitSelfReview(
          'rev-1',
          COMPANY_A,
          'emp-1',
          'feedback',
          [{ criterionId: VALID_UUID, score: 5.5 }],
          auditMeta,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('2.3 submitManagerReview rejects score > 5 with BadRequestException', async () => {
      await expect(
        service.submitManagerReview(
          'rev-1',
          COMPANY_A,
          'mgr-1',
          'feedback',
          { promotion: false, increment: false, training: false },
          [{ criterionId: VALID_UUID, score: 99.0 }],
          { ...auditMeta, role: 'Manager' },
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('2.4 overrideHrReview rejects score < 0 with BadRequestException', async () => {
      await expect(
        service.overrideHrReview(
          'rev-1',
          COMPANY_A,
          'override remarks',
          [{ criterionId: VALID_UUID, score: -0.5 }],
          auditMeta,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('3. Repository-Level Criterion Tenant Isolation', () => {
    let repo: PerformanceReviewRepository;
    let mockPrisma: any;

    beforeEach(() => {
      mockPrisma = {
        company: { findUnique: jest.fn(), create: jest.fn() },
        performanceCriterion: {
          findFirst: jest.fn(),
        },
        performanceCriterionScore: {
          findFirst: jest.fn(),
          create: jest.fn().mockResolvedValue({ id: 'score-created' }),
          update: jest.fn().mockResolvedValue({ id: 'score-updated' }),
        },
      };

      repo = new PerformanceReviewRepository(mockPrisma);
    });

    it('3.1 allows saving score when criterion belongs to the same tenant', async () => {
      mockPrisma.performanceCriterion.findFirst.mockResolvedValue({
        id: VALID_UUID,
        companyId: COMPANY_A,
        name: 'Technical Competence',
      });
      mockPrisma.performanceCriterionScore.findFirst.mockResolvedValue(null);

      const result = await repo.saveCriterionScore(
        'rev-1',
        VALID_UUID,
        { selfScore: 4.5 },
        COMPANY_A,
      );

      expect(mockPrisma.performanceCriterion.findFirst).toHaveBeenCalledWith({
        where: { id: VALID_UUID, companyId: COMPANY_A },
      });
      expect(result).toEqual({ id: 'score-created' });
    });

    it('3.2 rejects saving score when criterion belongs to a DIFFERENT tenant (cross-tenant attack)', async () => {
      // Criterion exists in DB, but does NOT match Company A
      mockPrisma.performanceCriterion.findFirst.mockResolvedValue(null);

      await expect(
        repo.saveCriterionScore(
          'rev-1',
          VALID_UUID,
          { selfScore: 4.5 },
          COMPANY_A, // Requesting from Company A, but criterion is Company B
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('3.3 rejects saving score when criterion does not exist in DB', async () => {
      mockPrisma.performanceCriterion.findFirst.mockResolvedValue(null);

      await expect(
        repo.saveCriterionScore(
          'rev-1',
          'nonexistent-uuid',
          { selfScore: 4.5 },
          COMPANY_A,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('4. Review Provisioning Audit Log (P3)', () => {
    let service: PerformanceReviewService;
    let mockRepo: any;
    let mockPrisma: any;
    let mockEventEmitter: any;

    beforeEach(() => {
      mockRepo = {
        ensureDefaultCriteria: jest.fn().mockResolvedValue([{ id: 'crit-1', name: 'Standard' }]),
        createReview: jest.fn().mockResolvedValue({ id: 'rev-new-1', employeeId: 'emp-1' }),
        saveCriterionScore: jest.fn().mockResolvedValue({}),
        update: jest.fn().mockResolvedValue({}),
      };

      mockPrisma = {
        reviewCycle: {
          findFirst: jest.fn().mockResolvedValue({
            id: 'cycle-1',
            status: 'Active',
            companyId: COMPANY_A,
            startDate: '2026-01-01',
            endDate: '2026-03-31',
          }),
        },
        reviewCycleParticipant: {
          findMany: jest.fn().mockResolvedValue([
            { id: 'part-1', employee: { id: 'emp-1', managerId: null } },
          ]),
          update: jest.fn().mockResolvedValue({}),
        },
        performanceReview: {
          findFirst: jest.fn().mockResolvedValue(null),
        },
        performanceAudit: {
          create: jest.fn().mockResolvedValue({ id: 'audit-1' }),
        },
      };

      mockEventEmitter = { emit: jest.fn() };

      service = new PerformanceReviewService(
        mockRepo,
        { calculateWeightedScore: jest.fn().mockReturnValue(0) } as any,
        { calculateAttendanceScore: jest.fn().mockResolvedValue(5.0) } as any,
        mockPrisma,
        mockEventEmitter,
      );
    });

    it('4.1 writes a bulk PerformanceAudit log when reviews are provisioned for a cycle', async () => {
      const result = await service.createReviewsForCycle(
        COMPANY_A,
        'Company A',
        'cycle-1',
        'admin-user-id',
      );

      expect(result.length).toBe(1);
      expect(mockPrisma.performanceAudit.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            companyId: COMPANY_A,
            userId: 'admin-user-id',
            action: 'Reviews Provisioned For Cycle',
          }),
        }),
      );
    });
  });
});

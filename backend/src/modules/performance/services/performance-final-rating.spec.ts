import { Test, TestingModule } from '@nestjs/testing';
import { PerformanceService } from './performance.service';
import { PerformanceReviewService } from './performance-review.service';
import { RatingEngineService } from './rating-engine.service';
import { AttendancePerformanceService } from './attendance-performance.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

describe('Performance Final Rating & Winner Authority Suite (Performance Phase 3)', () => {
  let performanceService: PerformanceService;
  let prisma: any;

  const COMPANY_ID = 'comp-tenant-alpha';
  const MANAGER_EMP_ID = 'emp-mgr-101';
  const DEPT_ID = 'dept-eng';

  beforeEach(async () => {
    prisma = {
      employee: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
      performanceReview: {
        findMany: jest.fn(),
      },
      performanceGoal: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      performanceAudit: {
        create: jest.fn().mockResolvedValue({}),
      },
      attendance: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PerformanceService,
        RatingEngineService,
        { provide: AttendancePerformanceService, useValue: {} },
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    performanceService = module.get<PerformanceService>(PerformanceService);
  });

  // ==========================================
  // 1. TOP PERFORMER / WINNER DETERMINATION
  // ==========================================
  describe('1. Winner & Top Performer Authority', () => {
    it('should determine the highest completed finalRating employee as the top performer', async () => {
      prisma.employee.findUnique.mockResolvedValue({
        id: MANAGER_EMP_ID,
        departmentId: DEPT_ID,
      });

      prisma.employee.findMany.mockResolvedValue([
        { id: 'emp-1', name: 'Alice Smith', departmentId: DEPT_ID, deletedAt: null },
        { id: 'emp-2', name: 'Bob Jones', departmentId: DEPT_ID, deletedAt: null },
        { id: 'emp-3', name: 'Charlie Brown', departmentId: DEPT_ID, deletedAt: null },
      ]);

      prisma.performanceReview.findMany.mockResolvedValue([
        {
          id: 'rev-1',
          employeeId: 'emp-1',
          status: 'Completed',
          finalRating: 4.8,
          attendanceRating: 4.5,
          employee: { id: 'emp-1', name: 'Alice Smith', deletedAt: null },
        },
        {
          id: 'rev-2',
          employeeId: 'emp-2',
          status: 'Completed',
          finalRating: 4.2,
          attendanceRating: 4.0,
          employee: { id: 'emp-2', name: 'Bob Jones', deletedAt: null },
        },
        {
          id: 'rev-3',
          employeeId: 'emp-3',
          status: 'Completed',
          finalRating: 3.6,
          attendanceRating: 3.5,
          employee: { id: 'emp-3', name: 'Charlie Brown', deletedAt: null },
        },
      ]);

      const analytics = await performanceService.getManagerDashboardAnalytics(
        COMPANY_ID,
        MANAGER_EMP_ID,
      );

      expect(analytics.topPerformer).toBe('Alice Smith');
      expect(analytics.lowestPerformer).toBe('Charlie Brown');
      expect(analytics.avgTeamRating).toBe(4.2);
    });

    it('Deterministic Tie Handling: should list all co-winners alphabetically when multiple employees tie for the top rating', async () => {
      prisma.employee.findUnique.mockResolvedValue({
        id: MANAGER_EMP_ID,
        departmentId: DEPT_ID,
      });

      prisma.employee.findMany.mockResolvedValue([
        { id: 'emp-1', name: 'Zara White', departmentId: DEPT_ID, deletedAt: null },
        { id: 'emp-2', name: 'Aaron Black', departmentId: DEPT_ID, deletedAt: null },
      ]);

      prisma.performanceReview.findMany.mockResolvedValue([
        {
          id: 'rev-1',
          employeeId: 'emp-1',
          status: 'Completed',
          finalRating: 4.9,
          attendanceRating: 4.8,
          employee: { id: 'emp-1', name: 'Zara White', deletedAt: null },
        },
        {
          id: 'rev-2',
          employeeId: 'emp-2',
          status: 'Completed',
          finalRating: 4.9,
          attendanceRating: 4.9,
          employee: { id: 'emp-2', name: 'Aaron Black', deletedAt: null },
        },
      ]);

      const analytics = await performanceService.getManagerDashboardAnalytics(
        COMPANY_ID,
        MANAGER_EMP_ID,
      );

      // Aaron Black sorted before Zara White alphabetically
      expect(analytics.topPerformer).toBe('Aaron Black, Zara White');
    });

    it('Status Eligibility: should strictly exclude in-progress (Draft, Self Review, Manager Review) reviews from winner calculation', async () => {
      prisma.employee.findUnique.mockResolvedValue({
        id: MANAGER_EMP_ID,
        departmentId: DEPT_ID,
      });

      prisma.employee.findMany.mockResolvedValue([
        { id: 'emp-1', name: 'Draft Dave', departmentId: DEPT_ID, deletedAt: null },
        { id: 'emp-2', name: 'Finalized Frank', departmentId: DEPT_ID, deletedAt: null },
      ]);

      prisma.performanceReview.findMany.mockResolvedValue([
        {
          id: 'rev-1',
          employeeId: 'emp-1',
          status: 'Draft',
          finalRating: 5.0, // High draft rating must NOT qualify
          attendanceRating: 5.0,
          employee: { id: 'emp-1', name: 'Draft Dave', deletedAt: null },
        },
        {
          id: 'rev-2',
          employeeId: 'emp-2',
          status: 'Completed',
          finalRating: 4.1,
          attendanceRating: 4.0,
          employee: { id: 'emp-2', name: 'Finalized Frank', deletedAt: null },
        },
      ]);

      const analytics = await performanceService.getManagerDashboardAnalytics(
        COMPANY_ID,
        MANAGER_EMP_ID,
      );

      expect(analytics.topPerformer).toBe('Finalized Frank');
    });

    it('Deleted Employee Protection: should ignore deleted employees in winner calculations', async () => {
      prisma.employee.findUnique.mockResolvedValue({
        id: MANAGER_EMP_ID,
        departmentId: DEPT_ID,
      });

      prisma.employee.findMany.mockResolvedValue([
        { id: 'emp-deleted', name: 'Deleted Dan', departmentId: DEPT_ID, deletedAt: new Date() },
        { id: 'emp-active', name: 'Active Amy', departmentId: DEPT_ID, deletedAt: null },
      ]);

      prisma.performanceReview.findMany.mockResolvedValue([
        {
          id: 'rev-deleted',
          employeeId: 'emp-deleted',
          status: 'Completed',
          finalRating: 5.0,
          employee: { id: 'emp-deleted', name: 'Deleted Dan', deletedAt: new Date() },
        },
        {
          id: 'rev-active',
          employeeId: 'emp-active',
          status: 'Completed',
          finalRating: 4.4,
          employee: { id: 'emp-active', name: 'Active Amy', deletedAt: null },
        },
      ]);

      const analytics = await performanceService.getManagerDashboardAnalytics(
        COMPANY_ID,
        MANAGER_EMP_ID,
      );

      expect(analytics.topPerformer).toBe('Active Amy');
    });

    it('Empty State Handling: should return N/A when no completed reviews exist', async () => {
      prisma.employee.findUnique.mockResolvedValue({
        id: MANAGER_EMP_ID,
        departmentId: DEPT_ID,
      });

      prisma.employee.findMany.mockResolvedValue([]);
      prisma.performanceReview.findMany.mockResolvedValue([]);

      const analytics = await performanceService.getManagerDashboardAnalytics(
        COMPANY_ID,
        MANAGER_EMP_ID,
      );

      expect(analytics.topPerformer).toBe('N/A');
      expect(analytics.lowestPerformer).toBe('N/A');
    });
  });

  // ==========================================
  // 2. RATING ENGINE FORMULAS
  // ==========================================
  describe('2. Rating Engine Weighted Scores & Rounding', () => {
    const ratingEngine = new RatingEngineService();

    it('should compute exact weighted score and round to 1 decimal place', () => {
      const scores = [
        {
          id: 'sc-1',
          reviewId: 'rev-1',
          criterionId: 'c-1',
          selfScore: 4.0,
          managerScore: 4.0,
          hrScore: 4.5,
          remarks: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          criterion: { id: 'c-1', companyId: COMPANY_ID, name: 'Quality', weight: 2.0, description: null, createdAt: new Date(), updatedAt: new Date() },
        },
        {
          id: 'sc-2',
          reviewId: 'rev-1',
          criterionId: 'c-2',
          selfScore: 3.0,
          managerScore: 3.0,
          hrScore: 3.5,
          remarks: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          criterion: { id: 'c-2', companyId: COMPANY_ID, name: 'Speed', weight: 1.0, description: null, createdAt: new Date(), updatedAt: new Date() },
        },
      ];

      // ((4.5 * 2.0) + (3.5 * 1.0)) / (2.0 + 1.0) = (9.0 + 3.5) / 3.0 = 12.5 / 3.0 = 4.1666 -> 4.2
      const hrScore = ratingEngine.calculateWeightedScore(scores, 'hr');
      expect(hrScore).toBe(4.2);
    });

    it('should return correct descriptive rating labels according to canonical rating scale', () => {
      expect(ratingEngine.getRatingLabel(4.9)).toBe('Outstanding');
      expect(ratingEngine.getRatingLabel(4.5)).toBe('Excellent');
      expect(ratingEngine.getRatingLabel(3.9)).toBe('Very Good');
      expect(ratingEngine.getRatingLabel(3.5)).toBe('Good');
      expect(ratingEngine.getRatingLabel(3.0)).toBe('Meets Expectations');
      expect(ratingEngine.getRatingLabel(2.4)).toBe('Needs Improvement');
      expect(ratingEngine.getRatingLabel(2.0)).toBe('Poor');
      expect(ratingEngine.getRatingLabel(1.2)).toBe('Unsatisfactory');
    });
  });
});

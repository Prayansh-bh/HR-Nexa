import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { PerformanceController } from './performance.controller';
import { PerformanceService } from '../services/performance.service';
import { ReviewCycleService } from '../services/review-cycle.service';
import { PerformanceReviewService } from '../services/performance-review.service';
import { KpiService } from '../services/kpi.service';
import { GoalService } from '../services/goal.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { Role } from '../../auth/role.enum';
import { Permission } from '../../auth/permissions.enum';
import { AuthenticatedRequest } from '../../auth/interfaces/authenticated-request.interface';

describe('PerformanceController — My Reviews & Team Reviews Scoping Suite (Performance Phase 1)', () => {
  let controller: PerformanceController;
  let reviewService: any;

  const COMPANY_ID = 'comp-tenant-alpha';

  const createMockReq = (
    role: Role,
    employeeId?: string,
    permissions: Permission[] = [Permission.PERFORMANCE_REVIEWS_VIEW],
  ): AuthenticatedRequest =>
    ({
      user: {
        id: `usr-${role.toLowerCase()}-1`,
        email: `${role.toLowerCase()}@company.com`,
        name: `${role} User`,
        role,
        companyId: COMPANY_ID,
        employee: employeeId ? { id: employeeId, companyId: COMPANY_ID } : null,
        permissions,
      },
      ip: '127.0.0.1',
      headers: { 'user-agent': 'Jest' },
    } as unknown as AuthenticatedRequest);

  beforeEach(async () => {
    reviewService = {
      findReviews: jest.fn().mockResolvedValue({
        data: [],
        total: 0,
        page: 1,
        limit: 50,
        totalPages: 0,
      }),
      findReviewById: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PerformanceController],
      providers: [
        { provide: PerformanceService, useValue: {} },
        { provide: ReviewCycleService, useValue: {} },
        { provide: PerformanceReviewService, useValue: reviewService },
        { provide: KpiService, useValue: {} },
        { provide: GoalService, useValue: {} },
        { provide: PrismaService, useValue: {} },
      ],
    }).compile();

    controller = module.get<PerformanceController>(PerformanceController);
  });

  // ==========================================
  // 1. EMPLOYEE REVIEWS SCOPING
  // ==========================================
  describe('1. Employee Scoping (GET /performance/reviews)', () => {
    it('should force employee to only query their own reviews (ignores spoofed employeeId)', async () => {
      const req = createMockReq(Role.Employee, 'emp-alice-101');

      await controller.getReviews(req, '1', '50', 'emp-spoofed-999');

      expect(reviewService.findReviews).toHaveBeenCalledWith(
        COMPANY_ID,
        expect.objectContaining({
          employeeId: 'emp-alice-101',
        }),
      );
    });

    it('should return empty paginated response if employee user has no linked employee profile', async () => {
      const req = createMockReq(Role.Employee, undefined);

      const res = await controller.getReviews(req, '1', '50');

      expect(res.data).toEqual([]);
      expect(reviewService.findReviews).not.toHaveBeenCalled();
    });
  });

  // ==========================================
  // 2. MANAGER REVIEWS SCOPING (My Reviews vs Team Reviews)
  // ==========================================
  describe('2. Manager Scoping (GET /performance/reviews)', () => {
    it('My Reviews: should query own reviews when employeeId matches manager own ID (without forcing managerId constraint)', async () => {
      const req = createMockReq(Role.Manager, 'emp-manager-bob');

      // Manager accessing "My Reviews" page
      await controller.getReviews(req, '1', '50', 'emp-manager-bob');

      expect(reviewService.findReviews).toHaveBeenCalledWith(
        COMPANY_ID,
        {
          employeeId: 'emp-manager-bob',
          reviewCycleId: undefined,
          status: undefined,
          page: 1,
          limit: 50,
        },
      );
      // Ensure managerId is NOT constrained in My Reviews query so manager can see their own appraisals
      expect(reviewService.findReviews).not.toHaveBeenCalledWith(
        COMPANY_ID,
        expect.objectContaining({ managerId: 'emp-manager-bob' }),
      );
    });

    it('Team Reviews: should enforce managerId = self when employeeId is omitted', async () => {
      const req = createMockReq(Role.Manager, 'emp-manager-bob');

      // Manager accessing "Team Reviews" overview
      await controller.getReviews(req, '1', '50');

      expect(reviewService.findReviews).toHaveBeenCalledWith(
        COMPANY_ID,
        expect.objectContaining({
          managerId: 'emp-manager-bob',
          employeeId: undefined,
        }),
      );
    });

    it('Team Reviews: should override spoofed managerId with manager own employee ID', async () => {
      const req = createMockReq(Role.Manager, 'emp-manager-bob');

      // Manager trying to pass managerId=other-manager
      await controller.getReviews(req, '1', '50', undefined, 'other-manager-charlie');

      expect(reviewService.findReviews).toHaveBeenCalledWith(
        COMPANY_ID,
        expect.objectContaining({
          managerId: 'emp-manager-bob',
        }),
      );
    });

    it('Team Reviews: should allow filtering by a direct report employeeId within manager own team', async () => {
      const req = createMockReq(Role.Manager, 'emp-manager-bob');

      // Manager viewing a specific team member
      await controller.getReviews(req, '1', '50', 'emp-report-dave');

      expect(reviewService.findReviews).toHaveBeenCalledWith(
        COMPANY_ID,
        expect.objectContaining({
          managerId: 'emp-manager-bob',
          employeeId: 'emp-report-dave',
        }),
      );
    });
  });

  // ==========================================
  // 3. ADMIN & NON-ADMIN ROLES SCOPING
  // ==========================================
  describe('3. Admin & Non-Admin Scoping (GET /performance/reviews)', () => {
    it('HRAdmin: should allow unrestricted tenant-wide queries', async () => {
      const req = createMockReq(Role.HRAdmin, 'emp-hr-1', [
        Permission.PERFORMANCE_REVIEWS_VIEW,
        Permission.PERFORMANCE_CYCLES_MANAGE,
      ]);

      await controller.getReviews(req, '1', '50', 'emp-any-user', 'mgr-any-user');

      expect(reviewService.findReviews).toHaveBeenCalledWith(
        COMPANY_ID,
        expect.objectContaining({
          employeeId: 'emp-any-user',
          managerId: 'mgr-any-user',
        }),
      );
    });

    it('Non-admin role without manage permission: should restrict query to self employee ID', async () => {
      const req = createMockReq(Role.Viewer, 'emp-viewer-1', [
        Permission.PERFORMANCE_REVIEWS_VIEW,
      ]);

      await controller.getReviews(req, '1', '50', 'emp-target-someone-else');

      expect(reviewService.findReviews).toHaveBeenCalledWith(
        COMPANY_ID,
        expect.objectContaining({
          employeeId: 'emp-viewer-1',
        }),
      );
    });
  });

  // ==========================================
  // 4. SINGLE REVIEW ACCESS SCOPING (GET /performance/reviews/:id)
  // ==========================================
  describe('4. Single Review Anti-Enumeration Scoping (GET /performance/reviews/:id)', () => {
    it('Employee: allows access to own review', async () => {
      const req = createMockReq(Role.Employee, 'emp-alice-101');
      reviewService.findReviewById.mockResolvedValue({
        id: 'rev-101',
        employeeId: 'emp-alice-101',
        managerId: 'emp-manager-bob',
        companyId: COMPANY_ID,
      });

      const res = await controller.getReviewById(req, 'rev-101');
      expect(res.id).toBe('rev-101');
    });

    it('Employee: throws 404 NotFoundException when accessing someone else review', async () => {
      const req = createMockReq(Role.Employee, 'emp-alice-101');
      reviewService.findReviewById.mockResolvedValue({
        id: 'rev-202',
        employeeId: 'emp-other-user',
        managerId: 'emp-manager-bob',
        companyId: COMPANY_ID,
      });

      await expect(controller.getReviewById(req, 'rev-202')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('Manager: allows access to own performance review (as an employee)', async () => {
      const req = createMockReq(Role.Manager, 'emp-manager-bob');
      reviewService.findReviewById.mockResolvedValue({
        id: 'rev-bob-self',
        employeeId: 'emp-manager-bob',
        managerId: 'emp-director-eve',
        companyId: COMPANY_ID,
      });

      const res = await controller.getReviewById(req, 'rev-bob-self');
      expect(res.id).toBe('rev-bob-self');
    });

    it('Manager: allows access to direct report review (as a manager)', async () => {
      const req = createMockReq(Role.Manager, 'emp-manager-bob');
      reviewService.findReviewById.mockResolvedValue({
        id: 'rev-report-1',
        employeeId: 'emp-alice-101',
        managerId: 'emp-manager-bob',
        companyId: COMPANY_ID,
      });

      const res = await controller.getReviewById(req, 'rev-report-1');
      expect(res.id).toBe('rev-report-1');
    });

    it('Manager: throws 404 NotFoundException when accessing a review of an unmanaged employee', async () => {
      const req = createMockReq(Role.Manager, 'emp-manager-bob');
      reviewService.findReviewById.mockResolvedValue({
        id: 'rev-stranger',
        employeeId: 'emp-stranger-999',
        managerId: 'emp-other-manager-888',
        companyId: COMPANY_ID,
      });

      await expect(controller.getReviewById(req, 'rev-stranger')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('HRAdmin: allows access to any review within tenant', async () => {
      const req = createMockReq(Role.HRAdmin, 'emp-hr-1', [
        Permission.PERFORMANCE_REVIEWS_VIEW,
        Permission.PERFORMANCE_CYCLES_MANAGE,
      ]);
      reviewService.findReviewById.mockResolvedValue({
        id: 'rev-any-claim',
        employeeId: 'emp-anyone',
        managerId: 'emp-anyone-mgr',
        companyId: COMPANY_ID,
      });

      const res = await controller.getReviewById(req, 'rev-any-claim');
      expect(res.id).toBe('rev-any-claim');
    });
  });
});

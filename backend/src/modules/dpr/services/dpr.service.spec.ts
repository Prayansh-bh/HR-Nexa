import { Test, TestingModule } from '@nestjs/testing';
import { DprService } from './dpr.service';
import { DprRepository } from '../repositories/dpr.repository';
import { PrismaService } from '../../../prisma/prisma.service';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { DPRStatus } from '@prisma/client';
import { DPRTaskStatus } from '../dto/create-dpr.dto';

describe('DprService - Business Logic & Security Integration Tests', () => {
  let service: DprService;
  let repository: jest.Mocked<DprRepository>;
  let prisma: any;

  const mockRepository = {
    findById: jest.fn(),
    findByDate: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateStatus: jest.fn(),
    review: jest.fn(),
    findHistory: jest.fn(),
    findTeamReports: jest.fn(),
  };

  beforeEach(async () => {
    prisma = {
      $transaction: jest.fn(async (cb) => cb(prisma)),
      employee: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
      },
      dailyProgressReport: {
        create: jest.fn(),
        update: jest.fn(),
      },
      dPRTaskItem: {
        createMany: jest.fn(),
        deleteMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DprService,
        { provide: DprRepository, useValue: mockRepository },
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<DprService>(DprService);
    repository = module.get(DprRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('DPR Submissions and Drafts', () => {
    it('should create own DPR draft successfully', async () => {
      const dto = {
        reportDate: '2026-08-20',
        summary: 'Finished coding DPR module',
        tasks: [
          { title: 'Task 1', status: DPRTaskStatus.COMPLETED, minutesSpent: 120 },
        ],
      };

      repository.findByDate.mockResolvedValue(null);
      repository.create.mockResolvedValue({ id: 'report-1', ...dto } as any);

      const result = await service.createMyDpr('COMPANY_A', 'emp-1', dto);

      expect(repository.findByDate).toHaveBeenCalledWith('COMPANY_A', 'emp-1', '2026-08-20');
      expect(repository.create).toHaveBeenCalledWith('COMPANY_A', 'emp-1', dto);
      expect(result).toHaveProperty('id', 'report-1');
    });

    it('should reject duplicate DPR for the same date', async () => {
      const dto = {
        reportDate: '2026-08-20',
        summary: 'Finished coding DPR module',
        tasks: [],
      };

      repository.findByDate.mockResolvedValue({ id: 'report-existing' } as any);

      await expect(service.createMyDpr('COMPANY_A', 'emp-1', dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should reject negative minutes spent on task', async () => {
      const dto = {
        reportDate: '2026-08-20',
        summary: 'Invalid tasks',
        tasks: [
          { title: 'Task 1', status: DPRTaskStatus.COMPLETED, minutesSpent: -10 },
        ],
      };

      repository.findByDate.mockResolvedValue(null);

      await expect(service.createMyDpr('COMPANY_A', 'emp-1', dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should allow zero minutes spent on task in draft creation', async () => {
      const dto = {
        reportDate: '2026-08-20',
        summary: 'Finished coding DPR module',
        tasks: [
          { title: 'Task 1', status: DPRTaskStatus.COMPLETED, minutesSpent: 0 },
        ],
      };

      repository.findByDate.mockResolvedValue(null);
      repository.create.mockResolvedValue({ id: 'report-1', ...dto } as any);

      const result = await service.createMyDpr('COMPANY_A', 'emp-1', dto);
      expect(result!.id).toBe('report-1');
    });

    it('should save/update own draft successfully', async () => {
      const dto = {
        summary: 'Updated summary',
        tasks: [
          { title: 'Task 1', status: DPRTaskStatus.COMPLETED, minutesSpent: 180 },
        ],
      };

      repository.findById.mockResolvedValue({
        id: 'report-1',
        employeeId: 'emp-1',
        companyId: 'COMPANY_A',
        status: DPRStatus.DRAFT,
      } as any);

      repository.update.mockResolvedValue({ id: 'report-1', ...dto } as any);

      const result = await service.updateMyDpr('COMPANY_A', 'emp-1', 'report-1', dto);

      expect(repository.update).toHaveBeenCalledWith('COMPANY_A', 'report-1', dto);
      expect(result!.summary).toBe('Updated summary');
    });

    it('should reject editing if report is already SUBMITTED or APPROVED', async () => {
      const dto = {
        summary: 'Updated summary',
        tasks: [],
      };

      repository.findById.mockResolvedValue({
        id: 'report-1',
        employeeId: 'emp-1',
        companyId: 'COMPANY_A',
        status: DPRStatus.SUBMITTED,
      } as any);

      await expect(service.updateMyDpr('COMPANY_A', 'emp-1', 'report-1', dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should allow editing CORRECTION_REQUIRED DPR', async () => {
      const dto = {
        summary: 'Corrected summary',
        tasks: [
          { title: 'Task 1', status: DPRTaskStatus.COMPLETED, minutesSpent: 120 },
        ],
      };

      repository.findById.mockResolvedValue({
        id: 'report-1',
        employeeId: 'emp-1',
        companyId: 'COMPANY_A',
        status: DPRStatus.CORRECTION_REQUIRED,
      } as any);

      repository.update.mockResolvedValue({ id: 'report-1', ...dto } as any);

      const result = await service.updateMyDpr('COMPANY_A', 'emp-1', 'report-1', dto);
      expect(result!.summary).toBe('Corrected summary');
    });

    describe('submitMyDpr validation checks', () => {
      it('should submit successfully if validations pass', async () => {
        repository.findById.mockResolvedValue({
          id: 'report-1',
          employeeId: 'emp-1',
          companyId: 'COMPANY_A',
          status: DPRStatus.DRAFT,
          summary: 'Today I fixed bugs',
          tasks: [
            { title: 'Task 1', status: DPRTaskStatus.COMPLETED, minutesSpent: 60 },
          ],
        } as any);

        repository.updateStatus.mockResolvedValue({ id: 'report-1', status: DPRStatus.SUBMITTED });

        const result = await service.submitMyDpr('COMPANY_A', 'emp-1', 'report-1');
        expect(result.status).toBe(DPRStatus.SUBMITTED);
      });

      it('should reject submission if summary is empty', async () => {
        repository.findById.mockResolvedValue({
          id: 'report-1',
          employeeId: 'emp-1',
          companyId: 'COMPANY_A',
          status: DPRStatus.DRAFT,
          summary: '',
          tasks: [
            { title: 'Task 1', status: DPRTaskStatus.COMPLETED, minutesSpent: 60 },
          ],
        } as any);

        await expect(service.submitMyDpr('COMPANY_A', 'emp-1', 'report-1')).rejects.toThrow(
          BadRequestException,
        );
      });

      it('should reject submission if task minutes spent is less than 1', async () => {
        repository.findById.mockResolvedValue({
          id: 'report-1',
          employeeId: 'emp-1',
          companyId: 'COMPANY_A',
          status: DPRStatus.DRAFT,
          summary: 'Today I fixed bugs',
          tasks: [
            { title: 'Task 1', status: DPRTaskStatus.COMPLETED, minutesSpent: 0 },
          ],
        } as any);

        await expect(service.submitMyDpr('COMPANY_A', 'emp-1', 'report-1')).rejects.toThrow(
          BadRequestException,
        );
      });
    });
  });

  describe('Security Boundaries & Tenant Isolation', () => {
    it('Employee A cannot read Employee B\'s DPR', async () => {
      repository.findById.mockResolvedValue({
        id: 'report-1',
        employeeId: 'emp-b',
        companyId: 'COMPANY_A',
      } as any);

      await expect(service.getMyDprById('COMPANY_A', 'emp-a', 'report-1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('Employee A cannot modify Employee B\'s DPR', async () => {
      repository.findById.mockResolvedValue({
        id: 'report-1',
        employeeId: 'emp-b',
        companyId: 'COMPANY_A',
        status: DPRStatus.DRAFT,
      } as any);

      const dto = { summary: 'Hacked', tasks: [] };

      await expect(service.updateMyDpr('COMPANY_A', 'emp-a', 'report-1', dto)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('Company A cannot access Company B\'s DPR', async () => {
      // findById is scoped by companyId. If companyId mismatch, repository returns null.
      repository.findById.mockResolvedValue(null);

      await expect(service.getMyDprById('COMPANY_A', 'emp-a', 'report-of-company-b')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('Approvals & Manager Review Workflow', () => {
    it('should prevent employee from reviewing/approving own DPR', async () => {
      repository.findById.mockResolvedValue({
        id: 'report-1',
        employeeId: 'emp-1',
        companyId: 'COMPANY_A',
        status: DPRStatus.SUBMITTED,
      } as any);

      await expect(
        service.reviewReport('COMPANY_A', 'emp-1', false, 'report-1', DPRStatus.APPROVED),
      ).rejects.toThrow(BadRequestException);
    });

    it('should allow manager to approve direct subordinate\'s DPR', async () => {
      repository.findById.mockResolvedValue({
        id: 'report-1',
        employeeId: 'sub-1',
        companyId: 'COMPANY_A',
        status: DPRStatus.SUBMITTED,
      } as any);

      prisma.employee.findUnique.mockResolvedValue({
        id: 'sub-1',
        managerId: 'mgr-1',
      });

      repository.review.mockResolvedValue({
        id: 'report-1',
        status: DPRStatus.APPROVED,
        reviewedById: 'mgr-1',
      } as any);

      const result = await service.reviewReport(
        'COMPANY_A',
        'mgr-1',
        false,
        'report-1',
        DPRStatus.APPROVED,
        'Good job!',
      );

      expect(repository.review).toHaveBeenCalledWith(
        'COMPANY_A',
        'report-1',
        DPRStatus.APPROVED,
        'mgr-1',
        'Good job!',
      );
      expect(result.status).toBe(DPRStatus.APPROVED);
    });

    it('should reject manager reviewing an unrelated employee', async () => {
      repository.findById.mockResolvedValue({
        id: 'report-1',
        employeeId: 'other-emp',
        companyId: 'COMPANY_A',
        status: DPRStatus.SUBMITTED,
      } as any);

      prisma.employee.findUnique.mockResolvedValue({
        id: 'other-emp',
        managerId: 'different-mgr',
      });

      await expect(
        service.reviewReport('COMPANY_A', 'mgr-1', false, 'report-1', DPRStatus.APPROVED),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow HR Admin with dpr:manage to review tenant-wide DPRs', async () => {
      repository.findById.mockResolvedValue({
        id: 'report-1',
        employeeId: 'other-emp',
        companyId: 'COMPANY_A',
        status: DPRStatus.SUBMITTED,
      } as any);

      repository.review.mockResolvedValue({
        id: 'report-1',
        status: DPRStatus.APPROVED,
        reviewedById: 'hr-admin-1',
      } as any);

      const result = await service.reviewReport(
        'COMPANY_A',
        'hr-admin-1',
        true, // isHRAdmin = true
        'report-1',
        DPRStatus.APPROVED,
      );

      expect(result.status).toBe(DPRStatus.APPROVED);
    });
  });
});

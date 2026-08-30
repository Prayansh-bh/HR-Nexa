import { Test, TestingModule } from '@nestjs/testing';
import { DprController } from './dpr.controller';
import { DprService } from '../services/dpr.service';
import { CreateDprDto } from '../dto/create-dpr.dto';
import { UpdateDprDto } from '../dto/update-dpr.dto';
import { ReviewDprDto } from '../dto/review-dpr.dto';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { SubscriptionGuard } from '../../auth/subscription.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { PermissionsGuard } from '../../auth/permissions.guard';
import { DPRStatus, DPRTaskStatus } from '@prisma/client';
import { ForbiddenException } from '@nestjs/common';

describe('DprController - API & Guards Integration Specs', () => {
  let controller: DprController;
  let service: DprService;

  const mockDprService = {
    createMyDpr: jest.fn(),
    getMyHistory: jest.fn(),
    getMyDprById: jest.fn(),
    updateMyDpr: jest.fn(),
    submitMyDpr: jest.fn(),
    getTeamReports: jest.fn(),
    getTeamDprById: jest.fn(),
    reviewReport: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DprController],
      providers: [
        { provide: DprService, useValue: mockDprService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(SubscriptionGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(PermissionsGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<DprController>(DprController);
    service = module.get<DprService>(DprService);
  });

  const mockEmployeeUser = {
    id: 'user-emp-1',
    role: 'Employee',
    companyId: 'COMPANY_A',
    employee: { id: 'emp-1' },
    permissions: ['dpr:view', 'dpr:submit'],
  };

  describe('DPR Employee Actions', () => {
    it('should create today\'s DPR draft', async () => {
      const dto: CreateDprDto = {
        reportDate: '2026-08-20',
        summary: 'Testing controller',
        tasks: [
          { title: 'Test Task', status: DPRTaskStatus.COMPLETED, minutesSpent: 60 },
        ],
      };
      mockDprService.createMyDpr.mockResolvedValue({ id: 'report-1' });

      const req = { user: mockEmployeeUser } as any;
      const result = await controller.createMyDpr(req, dto);

      expect(service.createMyDpr).toHaveBeenCalledWith('COMPANY_A', 'emp-1', dto);
      expect(result).toEqual({ id: 'report-1' });
    });

    it('should reject requests with missing employee context', async () => {
      const dto: CreateDprDto = {
        reportDate: '2026-08-20',
        summary: 'Testing controller',
        tasks: [],
      };

      const req = { user: { id: 'user-no-emp', companyId: 'COMPANY_A' } } as any;
      await expect(controller.createMyDpr(req, dto)).rejects.toThrow(ForbiddenException);
    });

    it('should get own DPR history', async () => {
      mockDprService.getMyHistory.mockResolvedValue([]);
      const req = { user: mockEmployeeUser } as any;
      const result = await controller.getMyHistory(req);

      expect(service.getMyHistory).toHaveBeenCalledWith('COMPANY_A', 'emp-1');
      expect(result).toEqual([]);
    });

    it('should update own draft', async () => {
      const dto: UpdateDprDto = {
        summary: 'Updated summary',
        tasks: [],
      };
      mockDprService.updateMyDpr.mockResolvedValue({ id: 'report-1' });

      const req = { user: mockEmployeeUser } as any;
      const result = await controller.updateMyDpr(req, 'report-1', dto);

      expect(service.updateMyDpr).toHaveBeenCalledWith('COMPANY_A', 'emp-1', 'report-1', dto);
      expect(result).toEqual({ id: 'report-1' });
    });

    it('should submit own report', async () => {
      mockDprService.submitMyDpr.mockResolvedValue({ id: 'report-1', status: DPRStatus.SUBMITTED });

      const req = { user: mockEmployeeUser } as any;
      const result = await controller.submitMyDpr(req, 'report-1');

      expect(service.submitMyDpr).toHaveBeenCalledWith('COMPANY_A', 'emp-1', 'report-1');
      expect(result).toEqual({ id: 'report-1', status: DPRStatus.SUBMITTED });
    });
  });

  describe('DPR Manager Reviews', () => {
    const mockManagerUser = {
      id: 'user-mgr-1',
      role: 'Manager',
      companyId: 'COMPANY_A',
      employee: { id: 'mgr-1' },
      permissions: ['dpr:view', 'dpr:submit', 'dpr:approve'],
    };

    it('should fetch team reports for manager', async () => {
      mockDprService.getTeamReports.mockResolvedValue([]);

      const req = { user: mockManagerUser } as any;
      const result = await controller.getTeamReports(req, undefined, '2026-08-20', undefined);

      expect(service.getTeamReports).toHaveBeenCalledWith('COMPANY_A', 'mgr-1', false, {
        employeeId: undefined,
        reportDate: '2026-08-20',
        status: undefined,
      });
      expect(result).toEqual([]);
    });

    it('should approve subordinate report', async () => {
      const dto: ReviewDprDto = { reviewerRemark: 'Excellent work' };
      mockDprService.reviewReport.mockResolvedValue({ id: 'report-1', status: DPRStatus.APPROVED });

      const req = { user: mockManagerUser } as any;
      const result = await controller.approveReport(req, 'report-1', dto);

      expect(service.reviewReport).toHaveBeenCalledWith(
        'COMPANY_A',
        'mgr-1',
        false,
        'report-1',
        DPRStatus.APPROVED,
        'Excellent work',
      );
      expect(result).toEqual({ id: 'report-1', status: DPRStatus.APPROVED });
    });
  });
});

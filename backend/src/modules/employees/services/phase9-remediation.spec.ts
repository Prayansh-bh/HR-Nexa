import { Test, TestingModule } from '@nestjs/testing';
import { EmployeesService } from './employees.service';
import { EmployeeUserLinkService } from './employee-user-link.service';
import { EmployeesRepository } from '../repositories/employees.repository';
import { PrismaService } from '../../../prisma/prisma.service';
import { SeatLimitService } from '../../subscriptions/services/seat-limit.service';
import { EmployeeDepartmentSyncService } from './employee-department-sync.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ExitSettlementService } from '../../exit/settlement/exit-settlement.service';
import { RecruitmentService } from '../../recruitment/services/recruitment.service';
import { RecruitmentRepository } from '../../recruitment/repositories/recruitment.repository';
import { SalaryComponentCalculatorService } from '../../payroll/services/salary-component-calculator.service';
import { StatutoryRulesService } from '../../payroll/services/statutory-rules.service';
import { StorageService } from '../../../common/storage/storage.service';
import { DocumentsRepository } from '../../documents/repositories/documents.repository';
import { OfferLetterTemplateService } from '../../../common/documents/offer-letter-template.service';

describe('Phase 9 Forensic Remediation Test Suite (P8-01, P8-02, P8-03, P8-04)', () => {
  let employeesService: EmployeesService;
  let exitSettlementService: ExitSettlementService;
  let recruitmentService: RecruitmentService;
  let prisma: any;
  let seatLimitService: any;
  let userLinkService: any;

  beforeEach(async () => {
    prisma = {
      $transaction: jest.fn().mockImplementation(async (cb) => cb(prisma)),
      employee: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockImplementation((args) => Promise.resolve({ ...args.data })),
        update: jest.fn().mockImplementation((args) => Promise.resolve({ ...args.data })),
        delete: jest.fn().mockResolvedValue({ id: 'EMP001' }),
        count: jest.fn().mockResolvedValue(0),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation((args) => Promise.resolve({ id: 'user-1', ...args.data })),
        delete: jest.fn().mockResolvedValue({ id: 'user-1' }),
      },
      exit: {
        findFirst: jest.fn(),
        update: jest.fn().mockResolvedValue({ id: 'exit-1' }),
      },
      exitSettlement: {
        upsert: jest.fn().mockResolvedValue({ id: 'settle-1' }),
      },
      candidate: {
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue({ id: 'cand-1', name: 'Alice Smith', email: 'alice@corp.com' }),
      },
      offer: {
        findFirst: jest.fn(),
        update: jest.fn().mockResolvedValue({ id: 'offer-1' }),
      },
      department: {
        findFirst: jest.fn().mockResolvedValue({ id: 'dept-1', name: 'Engineering' }),
        create: jest.fn().mockResolvedValue({ id: 'dept-1', name: 'Engineering' }),
      },
      designation: {
        findFirst: jest.fn().mockResolvedValue({ id: 'desig-1', name: 'Engineer' }),
        create: jest.fn().mockResolvedValue({ id: 'desig-1', name: 'Engineer' }),
      },
      subscription: {
        findUnique: jest.fn().mockResolvedValue({ id: 'sub-1', company: 'Acme' }),
      },
    };

    seatLimitService = {
      verifyCanAddEmployee: jest.fn().mockResolvedValue(undefined),
      syncEmployeeCounts: jest.fn().mockResolvedValue(undefined),
    };

    userLinkService = {
      getOrCreateUserForEmployee: jest.fn().mockResolvedValue('user-1'),
      removeLinkedUser: jest.fn().mockResolvedValue(undefined),
      updateLinkedUser: jest.fn().mockResolvedValue(undefined),
    };

    const recruitmentRepo = {
      getCandidateById: jest.fn().mockImplementation((id) =>
        Promise.resolve({
          id,
          name: 'Alice Smith',
          email: 'alice@corp.com',
          stage: 'Interview',
        }),
      ),
      updateCandidateStage: jest.fn().mockImplementation((id, _scope, stage) =>
        Promise.resolve({
          id,
          name: 'Alice Smith',
          email: 'alice@corp.com',
          stage,
        }),
      ),
    };

    const employeesRepo = {
      findByIdAndTenant: jest.fn().mockResolvedValue({
        id: 'EMP001',
        name: 'Deletable Emp',
        userId: 'user-to-delete',
        subscriptionId: 'sub-1',
      }),
      delete: jest.fn().mockResolvedValue({ id: 'EMP001' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmployeesService,
        ExitSettlementService,
        RecruitmentService,
        { provide: PrismaService, useValue: prisma },
        { provide: EmployeesRepository, useValue: employeesRepo },
        { provide: EmployeeUserLinkService, useValue: userLinkService },
        { provide: EmployeeDepartmentSyncService, useValue: { syncDepartmentHeadName: jest.fn() } },
        { provide: SeatLimitService, useValue: seatLimitService },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
        { provide: RecruitmentRepository, useValue: recruitmentRepo },
        { provide: SalaryComponentCalculatorService, useValue: {} },
        { provide: StatutoryRulesService, useValue: {} },
        { provide: StorageService, useValue: {} },
        { provide: DocumentsRepository, useValue: {} },
        { provide: OfferLetterTemplateService, useValue: {} },
      ],
    }).compile();

    employeesService = module.get<EmployeesService>(EmployeesService);
    exitSettlementService = module.get<ExitSettlementService>(ExitSettlementService);
    recruitmentService = module.get<RecruitmentService>(RecruitmentService);
  });

  describe('P8-01: Recruitment Annual CTC to Monthly Salary Conversion', () => {
    it('should convert candidate Annual CTC to monthly salary (e.g. 1200000 -> 100000)', async () => {
      prisma.candidate.findUnique = jest.fn().mockResolvedValue({
        id: 'cand-1',
        name: 'Alice Smith',
        email: 'alice@corp.com',
        stage: 'Interview',
      });
      prisma.offer.findFirst = jest.fn().mockResolvedValue({
        id: 'offer-1',
        annualCTC: 1200000,
        designation: 'Senior Lead',
        joiningDate: '2026-09-01',
      });
      prisma.employee.findMany = jest.fn().mockResolvedValue([]);

      await recruitmentService.updateCandidateStage('cand-1', { companyId: 'comp-1', subscriptionId: 'sub-1' } as any, 'Hired');

      expect(prisma.employee.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: 'Alice Smith',
            salary: 100000, // Exactly 1200000 / 12
          }),
        }),
      );
    });

    it('should correctly round non-divisible annual CTC (e.g. 1000000 / 12 -> 83333)', async () => {
      prisma.candidate.findUnique = jest.fn().mockResolvedValue({
        id: 'cand-2',
        name: 'Bob Jones',
        email: 'bob@corp.com',
        stage: 'Interview',
      });
      prisma.offer.findFirst = jest.fn().mockResolvedValue({
        id: 'offer-2',
        annualCTC: 1000000,
        designation: 'Engineer',
        joiningDate: '2026-09-01',
      });

      await recruitmentService.updateCandidateStage('cand-2', { companyId: 'comp-1', subscriptionId: 'sub-1' } as any, 'Hired');

      expect(prisma.employee.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            salary: 83333, // Math.round(1000000 / 12)
          }),
        }),
      );
    });
  });

  describe('P8-02: Recruitment Canonical Server-Side ID Generation', () => {
    it('should invoke generateNextEmployeeId instead of naive employee count', async () => {
      prisma.candidate.findUnique = jest.fn().mockResolvedValue({
        id: 'cand-3',
        name: 'Charlie Brown',
        email: 'charlie@corp.com',
        stage: 'Interview',
      });
      prisma.offer.findFirst = jest.fn().mockResolvedValue(null);

      // Existing employees EMP001, EMP005 in database (with gap!)
      prisma.employee.findMany = jest.fn().mockResolvedValue([{ id: 'EMP001' }, { id: 'EMP005' }]);

      await recruitmentService.updateCandidateStage('cand-3', { companyId: 'comp-1', subscriptionId: 'sub-1' } as any, 'Hired');

      expect(prisma.employee.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            id: 'EMP006', // Sequential next ID despite deleted gap!
          }),
        }),
      );
    });
  });

  describe('P8-03: Transactional Employee and User Deletion Atomicity', () => {
    it('should delete both User and Employee inside prisma.$transaction', async () => {
      prisma.employee.findUnique = jest.fn().mockResolvedValue({
        id: 'EMP001',
        name: 'Deletable Emp',
        userId: 'user-to-delete',
        subscriptionId: 'sub-1',
      });

      await employeesService.remove({ role: 'HRAdmin', companyId: 'comp-1' }, 'EMP001');

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(userLinkService.removeLinkedUser).toHaveBeenCalledWith(
        'user-to-delete',
        expect.anything(), // Transaction client
      );
      expect(prisma.employee.delete).toHaveBeenCalledWith({
        where: { id: 'EMP001' },
      });
      expect(seatLimitService.syncEmployeeCounts).toHaveBeenCalledWith('sub-1');
    });
  });

  describe('P8-04: Exit Settlement Employee Inactivation and Seat Deallocation', () => {
    it('should transition Employee.status to Inactive and call syncEmployeeCounts upon settlement', async () => {
      prisma.exit.findFirst = jest.fn().mockResolvedValue({
        id: 'exit-100',
        employeeId: 'EMP050',
        companyId: 'comp-1',
        employee: {
          id: 'EMP050',
          status: 'Active',
          salary: 60000,
          subscriptionId: 'sub-1',
        },
      });

      await exitSettlementService.generateSettlement('exit-100', 'comp-1');

      // 1. Exit marked COMPLETED
      expect(prisma.exit.update).toHaveBeenCalledWith({
        where: { id: 'exit-100' },
        data: expect.objectContaining({
          stage: 'COMPLETED',
          status: 'COMPLETED',
        }),
      });

      // 2. Employee marked Inactive
      expect(prisma.employee.update).toHaveBeenCalledWith({
        where: { id: 'EMP050' },
        data: { status: 'Inactive' },
      });

      // 3. Seat count synchronized
      expect(seatLimitService.syncEmployeeCounts).toHaveBeenCalledWith('sub-1');
    });

    it('should not double-decrement seats if employee was already Inactive', async () => {
      prisma.exit.findFirst = jest.fn().mockResolvedValue({
        id: 'exit-101',
        employeeId: 'EMP051',
        companyId: 'comp-1',
        employee: {
          id: 'EMP051',
          status: 'Inactive', // Already inactive
          salary: 60000,
          subscriptionId: 'sub-1',
        },
      });

      await exitSettlementService.generateSettlement('exit-101', 'comp-1');

      expect(prisma.employee.update).not.toHaveBeenCalled();
      expect(seatLimitService.syncEmployeeCounts).not.toHaveBeenCalled();
    });
  });
});

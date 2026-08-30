import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PayrollService } from './payroll.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { PayrollRepository } from '../repositories/payroll.repository';
import { PayrollEngineService } from './payroll-engine.service';
import { AuditLoggerService } from '../../../common/audit/audit-logger.service';
import { StatutoryRulesService } from './statutory-rules.service';
import { AttendanceMatrixService } from '../../attendance/services/attendance-matrix.service';
import { TaxCalculationService } from './tax-calculation.service';
import { ExpenseClaimRepository } from '../repositories/expense-claim.repository';
import { LopPolicyService } from './lop-policy.service';

describe('Payroll Two-Stage Workflow & State Machine (Forensic Test Suite)', () => {
  let service: PayrollService;
  let prisma: any;
  let expenseRepo: any;
  let payrollRepo: any;

  const mockHrAdmin = {
    id: 'user-hr-1',
    name: 'HR Admin',
    role: 'HRAdmin',
    companyId: 'comp-101',
    permissions: ['payroll:process:view', 'payroll:process:generate', 'payroll:slips:view'],
  };

  const mockAccountant = {
    id: 'user-acc-1',
    name: 'Accountant',
    role: 'Accountant',
    companyId: 'comp-101',
    permissions: ['payroll:process:view', 'payroll:process:run', 'payroll:process:lock', 'payroll:process:reopen'],
  };

  const mockActiveEmployee = {
    id: 'emp-1',
    name: 'Alice Smith',
    companyId: 'comp-101',
    status: 'Active',
    salary: 60000,
    pan: 'ABCDE1234F',
    uan: '100200300400',
    deletedAt: null,
    exits: [],
  };

  beforeEach(async () => {
    prisma = {
      systemConfig: {
        findUnique: jest.fn().mockResolvedValue(null),
        upsert: jest.fn().mockResolvedValue({ key: 'mock-key', value: 'LOCKED' }),
      },
      idempotencyKey: {
        create: jest.fn().mockResolvedValue({ id: 'idem-1' }),
        update: jest.fn().mockResolvedValue({ id: 'idem-1' }),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      employee: {
        findMany: jest.fn().mockResolvedValue([mockActiveEmployee]),
      },
      attendanceSetting: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      fiscalYear: {
        findFirst: jest.fn().mockResolvedValue({ id: 'fy-2026', status: 'ACTIVE' }),
      },
      payrollInput: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      payroll: {
        findMany: jest.fn().mockResolvedValue([]),
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
        update: jest.fn().mockResolvedValue({ id: 'pay-1', status: 'APPROVED' }),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({ id: 'audit-1' }),
      },
      outboxEvent: {
        create: jest.fn().mockResolvedValue({ id: 'outbox-1' }),
      },
      $transaction: jest.fn().mockImplementation(async (cb) => {
        return cb(prisma);
      }),
    };

    expenseRepo = {
      findUnpaidPayrollClaims: jest.fn().mockResolvedValue([]),
      markClaimsPaidByPayroll: jest.fn().mockResolvedValue({ count: 0 }),
    };

    payrollRepo = {
      findByIdAndTenant: jest.fn(),
      update: jest.fn(),
      findByMonth: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PayrollService,
        { provide: PrismaService, useValue: prisma },
        { provide: PayrollRepository, useValue: payrollRepo },
        {
          provide: PayrollEngineService,
          useValue: {
            calculateEmployeePayroll: jest.fn().mockReturnValue({
              fixedBaseSalary: 60000,
              basicSalary: 30000,
              gross: 60000,
              totalDeduct: 5000,
              net: 55000,
              lopDeductDays: 0,
              lopDeductAmount: 0,
              lopDivisorMode: 'CALENDAR_DAYS',
              lopDivisor: 30,
              workingDays: 22,
              presentDays: 22,
              components: [
                { name: 'Basic Salary', type: 'EARNING', amount: 30000 },
                { name: 'HRA', type: 'EARNING', amount: 15000 },
                { name: 'Special Allowance', type: 'EARNING', amount: 15000 },
                { name: 'PF Employee', type: 'DEDUCTION', amount: 1800 },
                { name: 'Professional Tax', type: 'DEDUCTION', amount: 200 },
                { name: 'TDS', type: 'DEDUCTION', amount: 3000 },
              ],
            }),
          },
        },
        {
          provide: AuditLoggerService,
          useValue: { logAction: jest.fn().mockResolvedValue(undefined) },
        },
        {
          provide: StatutoryRulesService,
          useValue: {
            getStatutoryRules: jest.fn().mockResolvedValue({
              pfRate: 0.12,
              tdsRate: 0.1,
              ptAmount: 200,
              basicPercentage: 0.5,
              hraPercentage: 0.5,
            }),
          },
        },
        {
          provide: AttendanceMatrixService,
          useValue: {
            getMatrix: jest.fn().mockResolvedValue({
              daysInMonth: 30,
              records: [
                {
                  employeeId: 'emp-1',
                  summary: {
                    present: 22,
                    late: 0,
                    halfDay: 0,
                    absent: 0,
                    weekend: 8,
                    lopDays: 0,
                  },
                },
              ],
            }),
          },
        },
        {
          provide: TaxCalculationService,
          useValue: {
            computeEmployeeMonthlyTds: jest.fn().mockResolvedValue({
              monthlyTdsDeduction: 3000,
              regime: 'NEW',
              cappedDeductionsTotal: 75000,
              totalAnnualTaxLiability: 36000,
              tdsWithheldSoFar: 0,
              remainingTaxLiability: 36000,
            }),
          },
        },
        { provide: ExpenseClaimRepository, useValue: expenseRepo },
        {
          provide: LopPolicyService,
          useValue: {
            resolvePolicy: jest.fn().mockResolvedValue({
              divisorMode: 'CALENDAR_DAYS',
              divisor: 30,
            }),
          },
        },
      ],
    }).compile();

    service = module.get<PayrollService>(PayrollService);
  });

  describe('1. Generate Payroll (Stage 1 - HR Admin)', () => {
    it('1. Generate creates DRAFT payroll records', async () => {
      const result = await service.generateDraftBatch({ month: '2026-08' }, mockHrAdmin);

      expect(result.status).toBe('DRAFT');
      expect(result.month).toBe('2026-08');
      expect(result.count).toBe(1);
      expect(prisma.payroll.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({
            employeeId: 'emp-1',
            status: 'DRAFT',
            month: '2026-08',
          }),
        ]),
      });
    });

    it('2. Generate does NOT lock the payroll period', async () => {
      await service.generateDraftBatch({ month: '2026-08' }, mockHrAdmin);
      expect(prisma.systemConfig.upsert).not.toHaveBeenCalled();
    });

    it('3. Generate does NOT mark expense claims as PAID', async () => {
      await service.generateDraftBatch({ month: '2026-08' }, mockHrAdmin);
      expect(expenseRepo.markClaimsPaidByPayroll).not.toHaveBeenCalled();
    });

    it('4. Generate rejects if period is already locked', async () => {
      prisma.systemConfig.findUnique.mockResolvedValueOnce({ value: 'LOCKED' });

      await expect(
        service.generateDraftBatch({ month: '2026-08' }, mockHrAdmin),
      ).rejects.toThrow(BadRequestException);
    });

    it('5. Generate rejects if existing records are already in APPROVED/LOCKED status', async () => {
      prisma.payroll.findMany.mockResolvedValueOnce([
        { id: 'pay-1', employeeId: 'emp-1', status: 'APPROVED' },
      ]);

      await expect(
        service.generateDraftBatch({ month: '2026-08' }, mockHrAdmin),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('2. Process Payroll (Stage 2 - Accountant)', () => {
    it('6. Process rejects execution if no DRAFT payroll records exist', async () => {
      prisma.payroll.findMany.mockResolvedValueOnce([]); // No existing records

      await expect(
        service.processBatch({ month: '2026-08', payDate: '2026-08-31' }, mockAccountant),
      ).rejects.toThrow(BadRequestException);
    });

    it('7. Process rejects execution if records are already in non-draft status', async () => {
      prisma.payroll.findMany.mockResolvedValueOnce([
        { id: 'pay-1', employeeId: 'emp-1', status: 'LOCKED' },
      ]);

      await expect(
        service.processBatch({ month: '2026-08', payDate: '2026-08-31' }, mockAccountant),
      ).rejects.toThrow(BadRequestException);
    });

    it('8. Process transitions DRAFT -> APPROVED and locks period in one transaction', async () => {
      prisma.payroll.findMany.mockResolvedValueOnce([
        { id: 'pay-1', employeeId: 'emp-1', status: 'DRAFT' },
      ]);

      const results = await service.processBatch(
        { month: '2026-08', payDate: '2026-08-31' },
        mockAccountant,
      );

      expect(results[0].status).toBe('APPROVED');
      expect(prisma.systemConfig.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: { value: 'LOCKED' },
          create: { key: expect.stringContaining('2026-08'), value: 'LOCKED' },
        }),
      );
      expect(prisma.outboxEvent.create).toHaveBeenCalled();
    });
  });

  describe('3. State Machine & Individual Slip Transitions', () => {
    it('9. Direct individual transition against DRAFT slip is rejected (No batch bypass)', () => {
      expect(() => {
        service.validateStatusTransition('DRAFT', 'APPROVED');
      }).toThrow(BadRequestException);

      expect(() => {
        service.validateStatusTransition('DRAFT', 'LOCKED');
      }).toThrow(BadRequestException);

      expect(() => {
        service.validateStatusTransition('DRAFT', 'PAID');
      }).toThrow(BadRequestException);
    });

    it('10. APPROVED -> LOCKED is permitted', () => {
      expect(() => {
        service.validateStatusTransition('APPROVED', 'LOCKED');
      }).not.toThrow();
    });

    it('11. LOCKED -> PAYMENT_INITIATED is permitted', () => {
      expect(() => {
        service.validateStatusTransition('LOCKED', 'PAYMENT_INITIATED');
      }).not.toThrow();
    });

    it('12. PAYMENT_INITIATED -> PAID is permitted', () => {
      expect(() => {
        service.validateStatusTransition('PAYMENT_INITIATED', 'PAID');
      }).not.toThrow();
    });

    it('13. PAID is permanently immutable (Terminal state)', () => {
      expect(() => {
        service.validateStatusTransition('PAID', 'DRAFT');
      }).toThrow(BadRequestException);

      expect(() => {
        service.validateStatusTransition('PAID', 'LOCKED');
      }).toThrow(BadRequestException);

      expect(() => {
        service.validateStatusTransition('PAID', 'APPROVED');
      }).toThrow(BadRequestException);
    });
  });

  describe('4. Concurrency, Idempotency & Tenant Security', () => {
    it('14. Locked payroll period cannot be regenerated', async () => {
      prisma.systemConfig.findUnique.mockResolvedValueOnce({ value: 'LOCKED' });

      await expect(
        service.generateDraftBatch({ month: '2026-08' }, mockHrAdmin),
      ).rejects.toThrow(BadRequestException);
    });

    it('15. Concurrent generation on same month is prevented via idempotency key', async () => {
      const err = new Error('Unique constraint failed on IdempotencyKey');
      (err as any).code = 'P2002';
      prisma.idempotencyKey.create.mockRejectedValueOnce(err);
      prisma.idempotencyKey.findUnique = jest.fn().mockResolvedValue({
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 100000),
      });

      await expect(
        service.generateDraftBatch({ month: '2026-08' }, mockHrAdmin),
      ).rejects.toThrow(BadRequestException);
    });

    it('16. Concurrent processing on same month is prevented via idempotency key', async () => {
      const err = new Error('Unique constraint failed on IdempotencyKey');
      (err as any).code = 'P2002';
      prisma.idempotencyKey.create.mockRejectedValueOnce(err);
      prisma.idempotencyKey.findUnique = jest.fn().mockResolvedValue({
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 100000),
      });

      await expect(
        service.processBatch({ month: '2026-08', payDate: '2026-08-31' }, mockAccountant),
      ).rejects.toThrow(BadRequestException);
    });

    it('17. Tenant isolation is enforced (Non-SuperAdmin cannot target another companyId)', async () => {
      await service.generateDraftBatch(
        { month: '2026-08', companyId: 'other-comp-999' },
        mockHrAdmin, // mockHrAdmin belongs to comp-101
      );

      // Verify queries are scoped to comp-101, NOT other-comp-999
      expect(prisma.employee.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            companyId: 'comp-101',
          }),
        }),
      );
    });

    it('18. Existing historical payroll records remain untouched during draft generation', async () => {
      prisma.payroll.findMany.mockResolvedValueOnce([
        { id: 'pay-historical', employeeId: 'emp-1', status: 'PAID' },
      ]);

      await expect(
        service.generateDraftBatch({ month: '2026-08' }, mockHrAdmin),
      ).rejects.toThrow(BadRequestException);

      expect(prisma.payroll.update).not.toHaveBeenCalled();
    });
  });
});

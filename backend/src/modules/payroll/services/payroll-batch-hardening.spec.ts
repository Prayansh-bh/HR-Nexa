import { ValidationPipe, BadRequestException } from '@nestjs/common';
import { BatchProcessPayrollDto, EmployeeAdjustmentDto } from '../dto/batch-process-payroll.dto';
import { PayrollService } from './payroll.service';
import * as classValidator from 'class-validator';
import * as classTransformer from 'class-transformer';

describe('HR NEXA — Payroll Batch Hardening & Input Boundary Tests', () => {
  let validationPipe: ValidationPipe;

  beforeEach(() => {
    validationPipe = new ValidationPipe({
      validatorPackage: classValidator,
      transformerPackage: classTransformer,
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    });
  });

  const transformAndValidate = async (metadata: any, payload: any) => {
    return validationPipe.transform(payload, metadata);
  };

  const dtoMetadata = {
    type: 'body' as const,
    metatype: BatchProcessPayrollDto,
  };

  describe('1. DTO Input Validation (Class-Validator & Type Guards)', () => {
    it('1. should PASS for valid LOPDays = 0', async () => {
      const payload = {
        month: 'July 2026',
        adjustments: {
          'EMP-101': { LOPDays: 0 },
        },
      };
      await expect(transformAndValidate(dtoMetadata, payload)).resolves.toBeDefined();
    });

    it('2. should PASS for valid LOPDays = 1.5', async () => {
      const payload = {
        month: 'July 2026',
        adjustments: {
          'EMP-101': { LOPDays: 1.5 },
        },
      };
      await expect(transformAndValidate(dtoMetadata, payload)).resolves.toBeDefined();
    });

    it('3. should PASS for valid overtimeHours = 8', async () => {
      const payload = {
        month: 'July 2026',
        adjustments: {
          'EMP-101': { overtimeHours: 8 },
        },
      };
      await expect(transformAndValidate(dtoMetadata, payload)).resolves.toBeDefined();
    });

    it('4. should PASS for valid bonus = 5000', async () => {
      const payload = {
        month: 'July 2026',
        adjustments: {
          'EMP-101': { bonus: 5000 },
        },
      };
      await expect(transformAndValidate(dtoMetadata, payload)).resolves.toBeDefined();
    });

    it('5. should PASS for valid deductions = 1000', async () => {
      const payload = {
        month: 'July 2026',
        adjustments: {
          'EMP-101': { deductions: 1000 },
        },
      };
      await expect(transformAndValidate(dtoMetadata, payload)).resolves.toBeDefined();
    });

    it('6. should PASS for valid remarks', async () => {
      const payload = {
        month: 'July 2026',
        adjustments: {
          'EMP-101': { remarks: 'Valid performance incentive' },
        },
      };
      await expect(transformAndValidate(dtoMetadata, payload)).resolves.toBeDefined();
    });

    it('7. should REJECT negative LOPDays = -1', async () => {
      const payload = {
        month: 'July 2026',
        adjustments: {
          'EMP-101': { LOPDays: -1 },
        },
      };
      await expect(transformAndValidate(dtoMetadata, payload)).rejects.toThrow(BadRequestException);
    });

    it('8. should REJECT negative overtimeHours = -1', async () => {
      const payload = {
        month: 'July 2026',
        adjustments: {
          'EMP-101': { overtimeHours: -1 },
        },
      };
      await expect(transformAndValidate(dtoMetadata, payload)).rejects.toThrow(BadRequestException);
    });

    it('9. should REJECT negative bonus = -500', async () => {
      const payload = {
        month: 'July 2026',
        adjustments: {
          'EMP-101': { bonus: -500 },
        },
      };
      await expect(transformAndValidate(dtoMetadata, payload)).rejects.toThrow(BadRequestException);
    });

    it('10. should REJECT negative deductions = -100', async () => {
      const payload = {
        month: 'July 2026',
        adjustments: {
          'EMP-101': { deductions: -100 },
        },
      };
      await expect(transformAndValidate(dtoMetadata, payload)).rejects.toThrow(BadRequestException);
    });

    it('11. should REJECT bonus = NaN', async () => {
      const payload = {
        month: 'July 2026',
        adjustments: {
          'EMP-101': { bonus: NaN },
        },
      };
      await expect(transformAndValidate(dtoMetadata, payload)).rejects.toThrow(BadRequestException);
    });

    it('12. should REJECT deductions = Infinity', async () => {
      const payload = {
        month: 'July 2026',
        adjustments: {
          'EMP-101': { deductions: Infinity },
        },
      };
      await expect(transformAndValidate(dtoMetadata, payload)).rejects.toThrow(BadRequestException);
    });

    it('13. should REJECT overtimeHours = -Infinity', async () => {
      const payload = {
        month: 'July 2026',
        adjustments: {
          'EMP-101': { overtimeHours: -Infinity },
        },
      };
      await expect(transformAndValidate(dtoMetadata, payload)).rejects.toThrow(BadRequestException);
    });

    it('14. should REJECT string LOPDays = "5"', async () => {
      const payload = {
        month: 'July 2026',
        adjustments: {
          'EMP-101': { LOPDays: '5' },
        },
      };
      await expect(transformAndValidate(dtoMetadata, payload)).rejects.toThrow(BadRequestException);
    });

    it('15. should REJECT string bonus = "1000"', async () => {
      const payload = {
        month: 'July 2026',
        adjustments: {
          'EMP-101': { bonus: '1000' },
        },
      };
      await expect(transformAndValidate(dtoMetadata, payload)).rejects.toThrow(BadRequestException);
    });

    it('16. should REJECT object bonus = {}', async () => {
      const payload = {
        month: 'July 2026',
        adjustments: {
          'EMP-101': { bonus: {} },
        },
      };
      await expect(transformAndValidate(dtoMetadata, payload)).rejects.toThrow(BadRequestException);
    });

    it('17. should REJECT array deductions = []', async () => {
      const payload = {
        month: 'July 2026',
        adjustments: {
          'EMP-101': { deductions: [] },
        },
      };
      await expect(transformAndValidate(dtoMetadata, payload)).rejects.toThrow(BadRequestException);
    });

    it('18. should REJECT unknown adjustment property when forbidNonWhitelisted is active', async () => {
      const payload = {
        month: 'July 2026',
        adjustments: {
          'EMP-101': { LOPDays: 1, maliciousField: 'hacked' },
        },
      };
      await expect(transformAndValidate(dtoMetadata, payload)).rejects.toThrow(BadRequestException);
    });

    it('19. should REJECT malformed adjustment non-object structure', async () => {
      const payload = {
        month: 'July 2026',
        adjustments: 'invalid-string-adjustments',
      };
      await expect(transformAndValidate(dtoMetadata, payload)).rejects.toThrow(BadRequestException);
    });
  });

  describe('2. Tenant Boundary & Employee Ownership Security Assertions', () => {
    let payrollService: PayrollService;
    let mockPrisma: any;
    let mockEngine: any;
    let mockAudit: any;
    let mockStat: any;
    let mockMatrix: any;
    let mockTax: any;
    let mockExpense: any;
    let mockLop: any;

    beforeEach(() => {
      mockPrisma = {
        systemConfig: {
          findUnique: jest.fn().mockResolvedValue(null),
          upsert: jest.fn().mockResolvedValue({ key: 'test', value: 'LOCKED' }),
        },
        idempotencyKey: {
          create: jest.fn().mockResolvedValue({}),
          update: jest.fn().mockResolvedValue({}),
          findUnique: jest.fn().mockResolvedValue(null),
        },
        employee: {
          findMany: jest.fn().mockResolvedValue([
            { id: 'EMP-COMPANY-A-1', name: 'Alice', salary: 50000, companyId: 'COMPANY-A' },
            { id: 'EMP-COMPANY-A-2', name: 'Bob', salary: 60000, companyId: 'COMPANY-A' },
          ]),
        },
        attendanceSetting: {
          findFirst: jest.fn().mockResolvedValue(null),
        },
        fiscalYear: {
          findFirst: jest.fn().mockResolvedValue(null),
        },
        payroll: {
          findMany: jest.fn().mockResolvedValue([]),
        },
        $transaction: jest.fn().mockImplementation((cb) => cb({
          payroll: { createMany: jest.fn(), update: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
          systemConfig: { upsert: jest.fn() },
          auditLog: { create: jest.fn() },
          outboxEvent: { create: jest.fn() },
        })),
      };

      mockEngine = {
        calculateEmployeePayroll: jest.fn().mockReturnValue({
          fixedBaseSalary: 50000,
          basicSalary: 25000,
          gross: 50000,
          totalDeduct: 5000,
          net: 45000,
          components: [],
          lopDeductDays: 0,
          lopDeductAmount: 0,
          lopDivisorMode: 'CALENDAR_DAYS',
          lopDivisor: 31,
          otPay: 0,
          workingDays: 22,
          presentDays: 22,
          calculationVersion: 2,
        }),
      };

      mockAudit = { logAction: jest.fn() };
      mockStat = { getStatutoryRules: jest.fn().mockResolvedValue({ pfRate: 12, ptAmount: 250, tdsRate: 10, basicPercentage: 50, hraPercentage: 20 }) };
      mockMatrix = {
        getMatrix: jest.fn().mockResolvedValue({
          daysInMonth: 31,
          records: [
            { employeeId: 'EMP-COMPANY-A-1', summary: { weekend: 8, present: 22, late: 0, halfDay: 0, absent: 0, lopDays: 0 } },
            { employeeId: 'EMP-COMPANY-A-2', summary: { weekend: 8, present: 22, late: 0, halfDay: 0, absent: 0, lopDays: 0 } },
          ],
        }),
      };
      mockTax = { computeEmployeeMonthlyTds: jest.fn() };
      mockExpense = { findUnpaidPayrollClaims: jest.fn().mockResolvedValue([]), markClaimsPaidByPayroll: jest.fn() };
      mockLop = { resolvePolicy: jest.fn().mockResolvedValue({ mode: 'CALENDAR_DAYS', divisor: 31 }) };

      payrollService = new PayrollService(
        mockPrisma,
        {} as any,
        mockEngine,
        mockAudit,
        mockStat,
        mockMatrix,
        mockTax,
        mockExpense,
        mockLop,
      );
    });

    it('20. should REJECT nonexistent employee ID in adjustments dictionary', async () => {
      const user = { id: 'usr1', role: 'HRAdmin', companyId: 'COMPANY-A' };
      const dto = {
        month: 'July 2026',
        payDate: '2026-07-31',
        status: 'Processed',
        adjustments: {
          'NONEXISTENT-EMP-ID': { LOPDays: 1 },
        },
      };

      await expect(payrollService.processBatch(dto as any, user)).rejects.toThrow(BadRequestException);
      expect(mockEngine.calculateEmployeePayroll).not.toHaveBeenCalled();
    });

    it('21 & 22. should REJECT adjustment using an employee from another company (COMPANY-B)', async () => {
      const user = { id: 'usr1', role: 'HRAdmin', companyId: 'COMPANY-A' };
      const dto = {
        month: 'July 2026',
        payDate: '2026-07-31',
        status: 'Processed',
        adjustments: {
          'EMPLOYEE_FROM_COMPANY_B': { bonus: 50000 },
        },
      };

      await expect(payrollService.processBatch(dto as any, user)).rejects.toThrow(BadRequestException);
    });

    it('23 & 24. SECURITY ASSERTION: Ensure cross-tenant employee is NEVER passed to PayrollEngineService', async () => {
      const user = { id: 'usr1', role: 'HRAdmin', companyId: 'COMPANY-A' };
      const dto = {
        month: 'July 2026',
        payDate: '2026-07-31',
        status: 'Processed',
        adjustments: {
          'ATTACKER_CROSS_TENANT_EMP': { LOPDays: 10, bonus: 100000 },
        },
      };

      mockPrisma.payroll.findMany.mockResolvedValueOnce([
        { id: 'p1', employeeId: 'emp1', status: 'DRAFT' },
      ]);

      try {
        await payrollService.processBatch(dto as any, user);
      } catch (err: any) {
        expect(err).toBeInstanceOf(BadRequestException);
        expect(err.message).toContain('ATTACKER_CROSS_TENANT_EMP');
      }

      // Critical Security Assertion
      expect(mockEngine.calculateEmployeePayroll).not.toHaveBeenCalled();
    });
  });
});

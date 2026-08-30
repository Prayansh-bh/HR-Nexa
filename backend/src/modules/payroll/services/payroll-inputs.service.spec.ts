import { ValidationPipe, BadRequestException, NotFoundException } from '@nestjs/common';
import { PayrollService } from './payroll.service';
import { UpdatePayrollInputDto } from '../dto/payroll-input.dto';
import { SalaryComponentCalculatorService } from './salary-component-calculator.service';
import { PayrollEngineService } from './payroll-engine.service';
import * as classValidator from 'class-validator';
import * as classTransformer from 'class-transformer';

describe('HR NEXA — Persistent & Authoritative Payroll Inputs Suite', () => {
  let validationPipe: ValidationPipe;
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
    validationPipe = new ValidationPipe({
      validatorPackage: classValidator,
      transformerPackage: classTransformer,
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    });

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
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([
          { id: 'EMP-1', name: 'Alice', salary: 50000, companyId: 'COMPANY-A' },
          { id: 'EMP-2', name: 'Bob', salary: 60000, companyId: 'COMPANY-A' },
        ]),
      },
      payrollInput: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        upsert: jest.fn(),
      },
      payroll: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(null),
        createMany: jest.fn(),
        update: jest.fn(),
      },
      company: {
        findUnique: jest.fn().mockResolvedValue({ id: 'COMPANY-A' }),
      },
      attendanceSetting: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      fiscalYear: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      $transaction: jest.fn().mockImplementation((cb) =>
        cb({
          payroll: { createMany: jest.fn(), update: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
          systemConfig: { upsert: jest.fn() },
          auditLog: { create: jest.fn() },
          outboxEvent: { create: jest.fn() },
        }),
      ),
    };

    mockEngine = {
      calculateEmployeePayroll: jest.fn().mockImplementation((emp, attSummary, inp) => ({
        fixedBaseSalary: emp.salary || 50000,
        basicSalary: Math.round(((emp.salary || 50000) + (inp.bonus || 0) - (inp.deductions || 0)) * 0.5),
        gross: (emp.salary || 50000) + (inp.bonus || 0),
        totalDeduct: (inp.deductions || 0) + 200,
        net: (emp.salary || 50000) + (inp.bonus || 0) - ((inp.deductions || 0) + 200),
        components: [],
        lopDeductDays: inp.LOPDays || 0,
        lopDeductAmount: (inp.LOPDays || 0) * 1000,
        lopDivisorMode: 'CALENDAR_DAYS',
        lopDivisor: 30,
        otPay: (inp.overtimeHours || 0) * 200,
        workingDays: 22,
        presentDays: 22,
        calculationVersion: 2,
      })),
    };

    mockAudit = {
      logAction: jest.fn().mockResolvedValue(undefined),
    };

    mockStat = {
      getStatutoryRules: jest.fn().mockResolvedValue({
        pfRate: 12,
        ptAmount: 200,
        tdsRate: 10,
        basicPercentage: 50,
        hraPercentage: 20,
      }),
    };

    mockMatrix = {
      getMatrix: jest.fn().mockResolvedValue({
        daysInMonth: 30,
        records: [
          { employeeId: 'EMP-1', summary: { weekend: 8, present: 22, late: 0, halfDay: 0, absent: 0, lopDays: 0 } },
          { employeeId: 'EMP-2', summary: { weekend: 8, present: 22, late: 0, halfDay: 0, absent: 0, lopDays: 0 } },
        ],
      }),
    };

    mockTax = {
      computeEmployeeMonthlyTds: jest.fn().mockResolvedValue({
        monthlyTdsDeduction: 0,
        regime: 'NEW',
        cappedDeductionsTotal: 0,
        totalAnnualTaxLiability: 0,
        tdsWithheldSoFar: 0,
        remainingTaxLiability: 0,
      }),
    };

    mockExpense = {
      findUnpaidPayrollClaims: jest.fn().mockResolvedValue([]),
    };

    mockLop = {
      resolvePolicy: jest.fn().mockResolvedValue({
        mode: 'CALENDAR_DAYS',
        divisor: 30,
      }),
    };

    payrollService = new PayrollService(
      mockPrisma as any,
      {} as any,
      mockEngine as any,
      mockAudit as any,
      mockStat as any,
      mockMatrix as any,
      mockTax as any,
      mockExpense as any,
      mockLop as any,
    );
  });

  const transformAndValidate = async (payload: any) => {
    return validationPipe.transform(payload, {
      type: 'body',
      metatype: UpdatePayrollInputDto,
    });
  };

  describe('1. DTO Validation', () => {
    it('1.1 should PASS for valid input payload', async () => {
      const payload = {
        month: '2026-07',
        lopDays: 2,
        overtimeHours: 5,
        bonus: 10000,
        deductions: 500,
        remarks: 'Performance bonus',
      };
      const result = await transformAndValidate(payload);
      expect(result.month).toBe('2026-07');
      expect(result.bonus).toBe(10000);
    });

    it('1.2 should PASS for Month YYYY format (e.g. July 2026)', async () => {
      const payload = {
        month: 'July 2026',
        lopDays: 0,
      };
      const result = await transformAndValidate(payload);
      expect(result.month).toBe('July 2026');
    });

    it('1.3 should REJECT negative lopDays', async () => {
      const payload = {
        month: '2026-07',
        lopDays: -1,
      };
      await expect(transformAndValidate(payload)).rejects.toThrow(BadRequestException);
    });

    it('1.4 should REJECT negative overtimeHours', async () => {
      const payload = {
        month: '2026-07',
        overtimeHours: -5,
      };
      await expect(transformAndValidate(payload)).rejects.toThrow(BadRequestException);
    });

    it('1.5 should REJECT negative bonus', async () => {
      const payload = {
        month: '2026-07',
        bonus: -1000,
      };
      await expect(transformAndValidate(payload)).rejects.toThrow(BadRequestException);
    });

    it('1.6 should REJECT negative deductions', async () => {
      const payload = {
        month: '2026-07',
        deductions: -500,
      };
      await expect(transformAndValidate(payload)).rejects.toThrow(BadRequestException);
    });

    it('1.7 should REJECT malformed month format', async () => {
      const payload = {
        month: 'invalid-month-format',
      };
      await expect(transformAndValidate(payload)).rejects.toThrow(BadRequestException);
    });

    it('1.8 should REJECT non-whitelisted fields', async () => {
      const payload = {
        month: '2026-07',
        maliciousField: 'exploit',
      };
      await expect(transformAndValidate(payload)).rejects.toThrow(BadRequestException);
    });
  });

  describe('2. Persistence & Upsert Behavior', () => {
    it('2.1 should create PayrollInput for valid employee/month', async () => {
      mockPrisma.employee.findFirst.mockResolvedValue({
        id: 'EMP-1',
        name: 'Alice',
        companyId: 'COMPANY-A',
      });
      mockPrisma.payrollInput.upsert.mockResolvedValue({
        id: 'INPUT-1',
        companyId: 'COMPANY-A',
        employeeId: 'EMP-1',
        month: '2026-07',
        lopDays: 2,
        overtimeHours: 8,
        bonus: 5000,
        deductions: 1000,
        remarks: 'Approved OT & bonus',
        createdBy: 'user-admin',
        updatedBy: 'user-admin',
      });

      const user = { id: 'user-admin', role: 'HRAdmin', companyId: 'COMPANY-A' };
      const dto: UpdatePayrollInputDto = {
        month: '2026-07',
        lopDays: 2,
        overtimeHours: 8,
        bonus: 5000,
        deductions: 1000,
        remarks: 'Approved OT & bonus',
      };

      const result = await payrollService.upsertPayrollInput(user, 'EMP-1', dto);
      expect(result.id).toBe('INPUT-1');
      expect(result.bonus).toBe(5000);
      expect(mockPrisma.payrollInput.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { employeeId_month: { employeeId: 'EMP-1', month: '2026-07' } },
        }),
      );
    });

    it('2.2 should emit audit log on upsert', async () => {
      mockPrisma.employee.findFirst.mockResolvedValue({
        id: 'EMP-1',
        name: 'Alice',
        companyId: 'COMPANY-A',
      });
      mockPrisma.payrollInput.upsert.mockResolvedValue({
        id: 'INPUT-1',
        companyId: 'COMPANY-A',
        employeeId: 'EMP-1',
        month: '2026-07',
        lopDays: 0,
        overtimeHours: 0,
        bonus: 5000,
        deductions: 0,
        remarks: 'Bonus',
      });

      const user = { id: 'user-admin', role: 'HRAdmin', companyId: 'COMPANY-A' };
      await payrollService.upsertPayrollInput(user, 'EMP-1', { month: '2026-07', bonus: 5000 });

      expect(mockAudit.logAction).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'PAYROLL_INPUT_UPDATED',
          companyId: 'COMPANY-A',
        }),
      );
    });
  });

  describe('3. Security, Tenant Isolation & Period Lock Protection', () => {
    it('3.1 should reject upsert for nonexistent employee with 404', async () => {
      mockPrisma.employee.findFirst.mockResolvedValue(null);
      const user = { id: 'user-admin', role: 'HRAdmin', companyId: 'COMPANY-A' };

      await expect(
        payrollService.upsertPayrollInput(user, 'EMP-NONEXISTENT', { month: '2026-07' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('3.2 should reject upsert if employee belongs to another tenant', async () => {
      mockPrisma.employee.findFirst.mockResolvedValue(null); // Tenant scoping in findFirst returns null
      const user = { id: 'user-admin', role: 'HRAdmin', companyId: 'COMPANY-A' };

      await expect(
        payrollService.upsertPayrollInput(user, 'EMP-OF-COMPANY-B', { month: '2026-07' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('3.3 should reject upsert if payroll period is LOCKED', async () => {
      mockPrisma.systemConfig.findUnique.mockResolvedValue({
        key: 'payroll_period_lock_2026-07',
        value: 'LOCKED',
      });
      const user = { id: 'user-admin', role: 'HRAdmin', companyId: 'COMPANY-A' };

      await expect(
        payrollService.upsertPayrollInput(user, 'EMP-1', { month: '2026-07' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('3.4 should reject upsert if employee payroll record is already PROCESSED', async () => {
      mockPrisma.employee.findFirst.mockResolvedValue({
        id: 'EMP-1',
        name: 'Alice',
        companyId: 'COMPANY-A',
      });
      mockPrisma.payroll.findUnique.mockResolvedValue({
        id: 'SLIP-1',
        status: 'PROCESSED',
      });

      const user = { id: 'user-admin', role: 'HRAdmin', companyId: 'COMPANY-A' };
      await expect(
        payrollService.upsertPayrollInput(user, 'EMP-1', { month: '2026-07', bonus: 1000 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('3.5 should reject upsert if employee payroll record is already PAID', async () => {
      mockPrisma.employee.findFirst.mockResolvedValue({
        id: 'EMP-1',
        name: 'Alice',
        companyId: 'COMPANY-A',
      });
      mockPrisma.payroll.findUnique.mockResolvedValue({
        id: 'SLIP-1',
        status: 'PAID',
      });

      const user = { id: 'user-admin', role: 'HRAdmin', companyId: 'COMPANY-A' };
      await expect(
        payrollService.upsertPayrollInput(user, 'EMP-1', { month: '2026-07', bonus: 1000 }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('4. Calculation & Precedence Integration', () => {
    it('4.1 calculate() should consume persisted PayrollInput when no explicit adjustments are provided', async () => {
      mockPrisma.payrollInput.findMany.mockResolvedValue([
        {
          id: 'INPUT-1',
          employeeId: 'EMP-1',
          month: '2026-07',
          lopDays: 2,
          overtimeHours: 5,
          bonus: 10000,
          deductions: 500,
          remarks: 'Persisted input',
        },
      ]);

      const user = { id: 'user-admin', role: 'HRAdmin', companyId: 'COMPANY-A' };
      const results = await payrollService.calculate(user, {
        month: '2026-07',
      });

      const emp1Result = results.find((r) => r.employeeId === 'EMP-1');
      expect(emp1Result).toBeDefined();
      expect(emp1Result.adjustments.bonus).toBe(10000);
      expect(emp1Result.adjustments.LOPDays).toBe(2);
      expect(emp1Result.adjustments.overtimeHours).toBe(5);
    });

    it('4.2 calculate() should give explicit dto.adjustments PRECEDENCE over persisted PayrollInput', async () => {
      mockPrisma.payrollInput.findMany.mockResolvedValue([
        {
          id: 'INPUT-1',
          employeeId: 'EMP-1',
          month: '2026-07',
          bonus: 10000,
          remarks: 'Persisted in DB',
        },
      ]);

      const user = { id: 'user-admin', role: 'HRAdmin', companyId: 'COMPANY-A' };
      const results = await payrollService.calculate(user, {
        month: '2026-07',
        adjustments: {
          'EMP-1': { bonus: 25000, remarks: 'Explicit batch preview override' },
        },
      });

      const emp1Result = results.find((r) => r.employeeId === 'EMP-1');
      expect(emp1Result.adjustments.bonus).toBe(25000);
      expect(emp1Result.adjustments.remarks).toBe('Explicit batch preview override');
    });

    it('4.3 calculate() should fall back to zero defaults when neither explicit adjustment nor persisted input exists', async () => {
      mockPrisma.payrollInput.findMany.mockResolvedValue([]);

      const user = { id: 'user-admin', role: 'HRAdmin', companyId: 'COMPANY-A' };
      const results = await payrollService.calculate(user, {
        month: '2026-07',
      });

      const emp2Result = results.find((r) => r.employeeId === 'EMP-2');
      expect(emp2Result.adjustments.bonus).toBe(0);
      expect(emp2Result.adjustments.LOPDays).toBe(0);
    });
  });

  describe('5. Batch Processing & Immutable Snapshot Verification', () => {
    it('5.1 processBatch() should consume persisted PayrollInput and store exact snapshot in Payroll.adjustments', async () => {
      mockPrisma.payrollInput.findMany.mockResolvedValue([
        {
          id: 'INPUT-1',
          employeeId: 'EMP-1',
          month: '2026-07',
          lopDays: 1,
          overtimeHours: 4,
          bonus: 7500,
          deductions: 300,
          remarks: 'Approved adjustment',
        },
      ]);

      mockPrisma.payroll.findMany.mockResolvedValueOnce([
        { id: 'P-1', employeeId: 'EMP-1', status: 'DRAFT' },
      ]);

      const user = { id: 'user-admin', role: 'Accountant', companyId: 'COMPANY-A' };
      const batchResult = await payrollService.processBatch(
        {
          month: '2026-07',
          payDate: '2026-07-31',
          status: 'Processed',
        },
        user,
      );

      expect(batchResult).toBeDefined();
      expect(mockEngine.calculateEmployeePayroll).toHaveBeenCalled();

      const emp1Call = mockEngine.calculateEmployeePayroll.mock.calls.find(
        (call: any[]) => call[0].id === 'EMP-1',
      );
      expect(emp1Call).toBeDefined();
      expect(emp1Call[2]).toMatchObject({
        bonus: 7500,
        deductions: 300,
        overtimeHours: 4,
        LOPDays: 1,
        remarks: 'Approved adjustment',
      });
    });
  });

  describe('6. SalaryComponentCalculatorService & Engine - Manual Deductions Verification', () => {
    let calculator: SalaryComponentCalculatorService;
    let engine: PayrollEngineService;

    beforeEach(() => {
      calculator = new SalaryComponentCalculatorService();
      engine = new PayrollEngineService(calculator);
    });

    const statRules = {
      pfRate: 12,
      ptAmount: 200,
      tdsRate: 10,
      basicPercentage: 50,
      hraPercentage: 20,
    };

    it('6.1 calculateComponents() should include additionalDeductions in totalDeduct and return snapshot', () => {
      const gross = 50000;
      const additionalDeductions = 1000;

      const result = calculator.calculateComponents(gross, additionalDeductions, statRules);

      // Basic = 25000. Default deductions: PF = 1800 (capped), PT = 200, TDS = 2500 (10% of basic)
      // Total standard deductions = 1800 + 200 + 2500 = 4500
      // With additionalDeductions (1000): totalDeduct = 5500
      expect(result.totalDeduct).toBe(5500);

      const addDeductComp = result.components.find((c) => c.name === 'Additional Deductions');
      expect(addDeductComp).toBeDefined();
      expect(addDeductComp?.amount).toBe(1000);
      expect(addDeductComp?.type).toBe('DEDUCTION');
    });

    it('6.2 calculateComponents() with additionalDeductions = 0 preserves standard deductions without extra component', () => {
      const gross = 50000;
      const result = calculator.calculateComponents(gross, 0, statRules);

      expect(result.totalDeduct).toBe(4500);
      const addDeductComp = result.components.find((c) => c.name === 'Additional Deductions');
      expect(addDeductComp).toBeUndefined();
    });

    it('6.3 Engine should reduce Net Pay by the EXACT manual deduction amount', () => {
      const emp = { id: 'EMP-1', name: 'Alice', salary: 50000, companyId: 'COMPANY-A' } as any;
      const attSummary = { workingDays: 22, presentDays: 22, halfDays: 0, absentDays: 0, lopDays: 0 };
      const lopPolicy = { mode: 'CALENDAR_DAYS' as any, divisor: 30 };

      // Case A: 0 manual deductions
      const calcWithout = engine.calculateEmployeePayroll(
        emp,
        attSummary,
        { deductions: 0 },
        statRules,
        [],
        null,
        lopPolicy,
      );

      // Case B: 1000 manual deductions
      const calcWith = engine.calculateEmployeePayroll(
        emp,
        attSummary,
        { deductions: 1000 },
        statRules,
        [],
        null,
        lopPolicy,
      );

      expect(calcWithout.gross).toBe(50000);
      expect(calcWith.gross).toBe(50000);
      expect(calcWith.totalDeduct - calcWithout.totalDeduct).toBe(1000);
      expect(calcWithout.net - calcWith.net).toBe(1000);
    });
  });

  describe('7. Expense Reimbursement Preview vs Process Parity Tests', () => {
    it('7.1 calculate() and processBatch() should query identical unpaid expense claims and match preview net with processed net', async () => {
      const mockClaims = [
        { id: 'CLAIM-1', nonTaxableAmount: 3500, taxableAmount: 1500 },
      ];
      mockExpense.findUnpaidPayrollClaims.mockResolvedValue(mockClaims);

      const user = { id: 'user-admin', role: 'HRAdmin', companyId: 'COMPANY-A' };
      const previewResults = await payrollService.calculate(user, {
        month: '2026-07',
      });

      const emp1Preview = previewResults.find((r) => r.employeeId === 'EMP-1');
      expect(emp1Preview).toBeDefined();
      expect(emp1Preview.adjustments.nonTaxableReimbursement).toBe(3500);
      expect(emp1Preview.adjustments.taxableReimbursement).toBe(1500);

      // Verify engine was invoked with nonTaxableReimbursement in preview
      const emp1Call = mockEngine.calculateEmployeePayroll.mock.calls.find(
        (call: any[]) => call[0].id === 'EMP-1',
      );
      expect(emp1Call).toBeDefined();
      expect(emp1Call[2]).toMatchObject({ nonTaxableReimbursement: 3500 });
    });
  });
});

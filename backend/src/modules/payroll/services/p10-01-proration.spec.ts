import { Test, TestingModule } from '@nestjs/testing';
import { Employee } from '@prisma/client';
import { PayrollEngineService, calculateEmploymentIntervalDays } from './payroll-engine.service';
import { SalaryComponentCalculatorService } from './salary-component-calculator.service';
import { LopPolicyResult } from './lop-policy.service';
import { StatutoryRules } from './statutory-rules.service';
import { resolveEffectiveExitDate } from './payroll.service';

describe('P10-01 & P10R-01: Mid-Month Joiner & Authoritative Exit Payroll Proration Suite', () => {
  let engine: PayrollEngineService;
  let componentCalculator: SalaryComponentCalculatorService;

  const defaultStatRules: StatutoryRules = {
    pfRate: 12.0,
    ptAmount: 200.0,
    tdsRate: 10.0,
    basicPercentage: 50.0,
    hraPercentage: 20.0,
  };

  const defaultAttendanceSummary = {
    workingDays: 30,
    presentDays: 30,
    halfDays: 0,
    absentDays: 0,
    lopDays: 0,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PayrollEngineService, SalaryComponentCalculatorService],
    }).compile();

    engine = module.get<PayrollEngineService>(PayrollEngineService);
    componentCalculator = module.get<SalaryComponentCalculatorService>(
      SalaryComponentCalculatorService,
    );
  });

  describe('1. resolveEffectiveExitDate Helper', () => {
    it('returns approvedLastWorkingDay when exit is APPROVED', () => {
      const emp = {
        id: 'EMP-1',
        exits: [
          {
            status: 'APPROVED',
            approvedLastWorkingDay: new Date('2026-09-10T00:00:00.000Z'),
            proposedLastWorkingDay: new Date('2026-09-15T00:00:00.000Z'),
          },
        ],
      };
      expect(resolveEffectiveExitDate(emp)).toEqual(new Date('2026-09-10T00:00:00.000Z'));
    });

    it('falls back to proposedLastWorkingDay when exit is COMPLETED without approvedLastWorkingDay', () => {
      const emp = {
        id: 'EMP-1',
        exits: [
          {
            status: 'COMPLETED',
            approvedLastWorkingDay: null,
            proposedLastWorkingDay: new Date('2026-09-10T00:00:00.000Z'),
          },
        ],
      };
      expect(resolveEffectiveExitDate(emp)).toEqual(new Date('2026-09-10T00:00:00.000Z'));
    });

    it('returns null when exit is PENDING or unapproved', () => {
      const emp = {
        id: 'EMP-1',
        exits: [
          {
            status: 'PENDING',
            proposedLastWorkingDay: new Date('2026-09-10T00:00:00.000Z'),
          },
        ],
      };
      expect(resolveEffectiveExitDate(emp)).toBeNull();
    });

    it('returns deletedAt as technical fallback if no exits exist', () => {
      const emp = {
        id: 'EMP-1',
        deletedAt: new Date('2026-09-10T00:00:00.000Z'),
        exits: [],
      };
      expect(resolveEffectiveExitDate(emp)).toEqual(new Date('2026-09-10T00:00:00.000Z'));
    });

    it('returns null when no exits or deletedAt exist', () => {
      const emp = { id: 'EMP-1', exits: [] };
      expect(resolveEffectiveExitDate(emp)).toBeNull();
    });
  });

  describe('2. calculateEmploymentIntervalDays helper', () => {
    it('returns 0 nonEmploymentDays when employee joined on or before month start and has no exit', () => {
      const res = calculateEmploymentIntervalDays('2026-09-01', null, 'September 2026');
      expect(res.nonEmploymentDays).toBe(0);
      expect(res.preJoiningDays).toBe(0);
      expect(res.postExitDays).toBe(0);
    });

    it('returns correct pre-joining days for mid-month joiner (Sept 25 in 30-day month)', () => {
      const res = calculateEmploymentIntervalDays('2026-09-25', null, 'September 2026');
      expect(res.preJoiningDays).toBe(24); // Sept 1..24 = 24 days
      expect(res.nonEmploymentDays).toBe(24);
      expect(res.postExitDays).toBe(0);
    });

    it('returns 29 pre-joining days when joining on last day of 30-day month (Sept 30)', () => {
      const res = calculateEmploymentIntervalDays('2026-09-30', null, 'September 2026');
      expect(res.preJoiningDays).toBe(29);
      expect(res.nonEmploymentDays).toBe(29);
    });

    it('returns full month (30 days) non-employment when joining in a future month', () => {
      const res = calculateEmploymentIntervalDays('2026-10-05', null, 'September 2026');
      expect(res.preJoiningDays).toBe(30);
      expect(res.nonEmploymentDays).toBe(30);
    });

    it('handles leap-year February 2024 (29 days) joined Feb 15', () => {
      const res = calculateEmploymentIntervalDays('2024-02-15', null, 'February 2024');
      expect(res.preJoiningDays).toBe(14); // Feb 1..14 = 14 days
      expect(res.nonEmploymentDays).toBe(14); // 29 - 14 = 15 payable days
    });

    it('handles non-leap February 2023 (28 days) joined Feb 15', () => {
      const res = calculateEmploymentIntervalDays('2023-02-15', null, 'February 2023');
      expect(res.preJoiningDays).toBe(14); // Feb 1..14 = 14 days
      expect(res.nonEmploymentDays).toBe(14); // 28 - 14 = 14 payable days
    });

    it('handles mid-month exit (exitDate = 2026-09-10 in 30-day month)', () => {
      const res = calculateEmploymentIntervalDays('2026-01-01', new Date('2026-09-10'), 'September 2026');
      expect(res.preJoiningDays).toBe(0);
      expect(res.postExitDays).toBe(20); // 30 - 10 = 20 unpayable days
      expect(res.nonEmploymentDays).toBe(20); // 10 payable days
    });

    it('handles same-month join and exit (joined 2026-09-05, exited 2026-09-20)', () => {
      const res = calculateEmploymentIntervalDays('2026-09-05', '2026-09-20', 'September 2026');
      expect(res.preJoiningDays).toBe(4);
      expect(res.postExitDays).toBe(10);
      expect(res.nonEmploymentDays).toBe(14); // 30 - 14 = 16 payable days (Sept 5..20)
    });
  });

  describe('3. PayrollEngineService calculateEmployeePayroll Proration & Boundary Cases', () => {
    const lopPolicy30: LopPolicyResult = { mode: 'CALENDAR_DAYS', divisor: 30 };

    it('CASE 1: Joined Sept 1, Approved LWD Sept 10 -> 10 payable days, gross ₹20,000', () => {
      const emp = {
        id: 'EMP-01',
        name: 'Sept 10 Exit',
        salary: 60000,
        joined: '2026-09-01',
      } as Employee;

      const res = engine.calculateEmployeePayroll(
        emp,
        defaultAttendanceSummary,
        undefined,
        defaultStatRules,
        [],
        undefined,
        lopPolicy30,
        'September 2026',
        new Date('2026-09-10'),
      );

      expect(res.prorationDays).toBe(20);
      expect(res.prorationDeductAmount).toBe(40000);
      expect(res.gross).toBe(20000);
    });

    it('CASE 2: Joined Sept 25, Approved LWD Sept 28 -> 4 payable days, gross ₹8,000', () => {
      const emp = {
        id: 'EMP-02',
        name: 'Mid Join & Exit',
        salary: 60000,
        joined: '2026-09-25',
      } as Employee;

      const res = engine.calculateEmployeePayroll(
        emp,
        defaultAttendanceSummary,
        undefined,
        defaultStatRules,
        [],
        undefined,
        lopPolicy30,
        'September 2026',
        new Date('2026-09-28'),
      );

      expect(res.prorationDays).toBe(26); // 24 pre-joining + 2 post-exit = 26
      expect(res.prorationDeductAmount).toBe(52000);
      expect(res.gross).toBe(8000); // 4 days @ 2000
    });

    it('CASE 3: Joined Sept 25, Approved LWD Sept 30 -> 6 payable days, gross ₹12,000', () => {
      const emp = {
        id: 'EMP-03',
        name: 'Mid Join Month End Exit',
        salary: 60000,
        joined: '2026-09-25',
      } as Employee;

      const res = engine.calculateEmployeePayroll(
        emp,
        defaultAttendanceSummary,
        undefined,
        defaultStatRules,
        [],
        undefined,
        lopPolicy30,
        'September 2026',
        new Date('2026-09-30'),
      );

      expect(res.prorationDays).toBe(24);
      expect(res.prorationDeductAmount).toBe(48000);
      expect(res.gross).toBe(12000);
    });

    it('CASE 4: Joined Sept 1, Proposed LWD Sept 10, Exit NOT approved (exitDate null) -> full month ₹60,000', () => {
      const emp = {
        id: 'EMP-04',
        name: 'Pending Exit',
        salary: 60000,
        joined: '2026-09-01',
      } as Employee;

      const res = engine.calculateEmployeePayroll(
        emp,
        defaultAttendanceSummary,
        undefined,
        defaultStatRules,
        [],
        undefined,
        lopPolicy30,
        'September 2026',
        null,
      );

      expect(res.prorationDays).toBe(0);
      expect(res.prorationDeductAmount).toBe(0);
      expect(res.gross).toBe(60000);
    });

    it('CASE 5: Joined Sept 1, Approved LWD Sept 10, Proposed LWD Sept 15 -> Approved wins, gross ₹20,000', () => {
      const emp = {
        id: 'EMP-05',
        name: 'Approved vs Proposed',
        salary: 60000,
        joined: '2026-09-01',
        exits: [
          {
            status: 'APPROVED',
            approvedLastWorkingDay: new Date('2026-09-10'),
            proposedLastWorkingDay: new Date('2026-09-15'),
          },
        ],
      } as any;

      const exitDate = resolveEffectiveExitDate(emp);
      expect(exitDate).toEqual(new Date('2026-09-10'));

      const res = engine.calculateEmployeePayroll(
        emp,
        defaultAttendanceSummary,
        undefined,
        defaultStatRules,
        [],
        undefined,
        lopPolicy30,
        'September 2026',
        exitDate,
      );

      expect(res.gross).toBe(20000);
    });

    it('CASE 6: Joined Sept 1, Completed Exit, Approved LWD Sept 10 -> gross ₹20,000', () => {
      const emp = {
        id: 'EMP-06',
        name: 'Completed Exit',
        salary: 60000,
        joined: '2026-09-01',
        exits: [
          {
            status: 'COMPLETED',
            approvedLastWorkingDay: new Date('2026-09-10'),
          },
        ],
      } as any;

      const exitDate = resolveEffectiveExitDate(emp);
      const res = engine.calculateEmployeePayroll(
        emp,
        defaultAttendanceSummary,
        undefined,
        defaultStatRules,
        [],
        undefined,
        lopPolicy30,
        'September 2026',
        exitDate,
      );

      expect(res.gross).toBe(20000);
    });

    it('CASE 7: LWD Aug 20, Payroll September -> gross ₹0', () => {
      const emp = {
        id: 'EMP-07',
        name: 'Past Exit',
        salary: 60000,
        joined: '2026-01-01',
      } as Employee;

      const res = engine.calculateEmployeePayroll(
        emp,
        defaultAttendanceSummary,
        undefined,
        defaultStatRules,
        [],
        undefined,
        lopPolicy30,
        'September 2026',
        new Date('2026-08-20'),
      );

      expect(res.prorationDays).toBe(30);
      expect(res.gross).toBe(0);
    });

    it('CASE 8: LWD Oct 15, Payroll September -> gross ₹60,000', () => {
      const emp = {
        id: 'EMP-08',
        name: 'Future Exit',
        salary: 60000,
        joined: '2026-01-01',
      } as Employee;

      const res = engine.calculateEmployeePayroll(
        emp,
        defaultAttendanceSummary,
        undefined,
        defaultStatRules,
        [],
        undefined,
        lopPolicy30,
        'September 2026',
        new Date('2026-10-15'),
      );

      expect(res.prorationDays).toBe(0);
      expect(res.gross).toBe(60000);
    });

    it('CASE 9: Joined Sept 5, Approved LWD Sept 20 -> payable days 16, gross ₹32,000', () => {
      const emp = {
        id: 'EMP-09',
        name: 'Join Sept 5 LWD Sept 20',
        salary: 60000,
        joined: '2026-09-05',
      } as Employee;

      const res = engine.calculateEmployeePayroll(
        emp,
        defaultAttendanceSummary,
        undefined,
        defaultStatRules,
        [],
        undefined,
        lopPolicy30,
        'September 2026',
        new Date('2026-09-20'),
      );

      expect(res.prorationDays).toBe(14); // 4 pre-join + 10 post-exit
      expect(res.prorationDeductAmount).toBe(28000);
      expect(res.gross).toBe(32000); // 16 * 2000
    });

    it('CASE 10: Leap year February 2024 (29 days), Joined Feb 1, LWD Feb 15 -> 15 payable days', () => {
      const lopPolicy29: LopPolicyResult = { mode: 'CALENDAR_DAYS', divisor: 29 };
      const emp = {
        id: 'EMP-10',
        name: 'Leap Feb Exiter',
        salary: 58000, // 2000/day
        joined: '2024-02-01',
      } as Employee;

      const res = engine.calculateEmployeePayroll(
        emp,
        defaultAttendanceSummary,
        undefined,
        defaultStatRules,
        [],
        undefined,
        lopPolicy29,
        'February 2024',
        new Date('2024-02-15'),
      );

      expect(res.prorationDays).toBe(14); // 29 - 15 = 14 unpayable days
      expect(res.gross).toBe(30000); // 15 days * 2000
    });

    it('STEP 7: Downstream statutory deduction consistency on prorated exit gross', () => {
      const emp = {
        id: 'EMP-11',
        name: 'Statutory Verification',
        salary: 60000,
        joined: '2026-09-01',
      } as Employee;

      // Exited Sept 10 -> Gross is ₹20,000
      const res = engine.calculateEmployeePayroll(
        emp,
        defaultAttendanceSummary,
        undefined,
        defaultStatRules,
        [],
        undefined,
        lopPolicy30,
        'September 2026',
        new Date('2026-09-10'),
      );

      expect(res.gross).toBe(20000);
      // Basic is 50% of gross = 10,000
      expect(res.basicSalary).toBe(10000);

      const pfComp = res.components.find((c) => c.name === 'Provident Fund');
      const ptComp = res.components.find((c) => c.name === 'Professional Tax');
      const tdsComp = res.components.find((c) => c.name === 'TDS');

      // PF is 12% of basic (10,000) = 1,200
      expect(pfComp?.amount).toBe(1200);
      // PT is 200
      expect(ptComp?.amount).toBe(200);
      // TDS is 10% of basic (10,000) = 1,000
      expect(tdsComp?.amount).toBe(1000);
      // Total deductions = 1200 + 200 + 1000 = 2400
      expect(res.totalDeduct).toBe(2400);
      // Net = 20000 - 2400 = 17600
      expect(res.net).toBe(17600);
    });
  });
});

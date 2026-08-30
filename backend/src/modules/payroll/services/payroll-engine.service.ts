import { BadRequestException, Injectable } from '@nestjs/common';
import { Employee } from '@prisma/client';
import { StatutoryRules } from './statutory-rules.service';
import {
  SalaryComponentCalculatorService,
  SalaryComponentSnapshot,
} from './salary-component-calculator.service';
import { calculateOvertimePay } from '../../../common/utils/attendance-rules.util';
import { parsePayrollMonth } from '../../../common/utils/date.util';

import { LopDivisorMode, LopPolicyResult } from './lop-policy.service';

export type AttendanceSummary = {
  workingDays: number;
  presentDays: number;
  halfDays: number;
  absentDays: number;
  lopDays: number;
};

export type PayslipResult = {
  fixedBaseSalary: number;
  basicSalary: number;
  gross: number;
  totalDeduct: number;
  net: number;
  components: SalaryComponentSnapshot[];
  lopDeductDays: number;
  lopDeductAmount: number;
  prorationDays: number;
  prorationDeductAmount: number;
  lopDivisorMode: LopDivisorMode;
  lopDivisor: number;
  otPay: number;
  workingDays: number;
  presentDays: number;
  calculationVersion: number;
};

export function calculateEmploymentIntervalDays(
  joinedStr: string | null | undefined,
  exitDate: Date | string | null | undefined,
  payrollMonth: string | undefined,
): { nonEmploymentDays: number; preJoiningDays: number; postExitDays: number } {
  if (!payrollMonth || typeof payrollMonth !== 'string') {
    return { nonEmploymentDays: 0, preJoiningDays: 0, postExitDays: 0 };
  }

  const parsed = parsePayrollMonth(payrollMonth);
  const totalDaysInMonth = parsed.daysInMonth;
  const year = parsed.year;
  const monthNum = parsed.monthNum; // 1-indexed

  const monthStartStr = `${year}-${String(monthNum).padStart(2, '0')}-01`;
  const monthEndStr = `${year}-${String(monthNum).padStart(2, '0')}-${String(totalDaysInMonth).padStart(2, '0')}`;

  let preJoiningDays = 0;
  if (joinedStr && typeof joinedStr === 'string' && joinedStr.trim()) {
    const trimmedJoined = joinedStr.trim().slice(0, 10);
    if (trimmedJoined > monthEndStr) {
      preJoiningDays = totalDaysInMonth; // Joined after this payroll period
    } else if (trimmedJoined > monthStartStr) {
      const joinParts = trimmedJoined.split('-');
      if (joinParts.length === 3) {
        const joinYear = parseInt(joinParts[0], 10);
        const joinMonth = parseInt(joinParts[1], 10);
        const joinDay = parseInt(joinParts[2], 10);
        if (joinYear === year && joinMonth === monthNum) {
          preJoiningDays = Math.max(0, Math.min(totalDaysInMonth, joinDay - 1));
        }
      }
    }
  }

  let postExitDays = 0;
  if (exitDate) {
    const exitDateStr = (
      exitDate instanceof Date ? exitDate.toISOString() : String(exitDate)
    ).slice(0, 10);
    if (exitDateStr < monthStartStr) {
      postExitDays = totalDaysInMonth; // Exited before this payroll period
    } else if (exitDateStr < monthEndStr) {
      const exitParts = exitDateStr.split('-');
      if (exitParts.length === 3) {
        const exitYear = parseInt(exitParts[0], 10);
        const exitMonth = parseInt(exitParts[1], 10);
        const exitDay = parseInt(exitParts[2], 10);
        if (exitYear === year && exitMonth === monthNum) {
          postExitDays = Math.max(
            0,
            Math.min(totalDaysInMonth, totalDaysInMonth - exitDay),
          );
        }
      }
    }
  }

  const nonEmploymentDays = Math.min(
    totalDaysInMonth,
    preJoiningDays + postExitDays,
  );
  return { nonEmploymentDays, preJoiningDays, postExitDays };
}

@Injectable()
export class PayrollEngineService {
  constructor(
    private readonly componentCalculator: SalaryComponentCalculatorService,
  ) {}

  calculateEmployeePayroll(
    e: Employee,
    attendanceSummary: AttendanceSummary,
    payrollInput: {
      LOPDays?: number;
      overtimeHours?: number;
      bonus?: number;
      deductions?: number;
      ptOverride?: number;
      tdsOverride?: number;
      nonTaxableReimbursement?: number;
    } | undefined,
    statRules: StatutoryRules | undefined,
    salaryComponents: any[] = [],
    attendanceSettings: any = undefined,
    lopPolicy: LopPolicyResult,
    payrollMonth?: string,
    exitDate?: Date | string | null,
  ): PayslipResult {
    if (!lopPolicy || !isFinite(lopPolicy.divisor) || lopPolicy.divisor <= 0) {
      throw new BadRequestException(
        'Payroll calculation requires a valid resolved LopPolicyResult with a positive divisor.',
      );
    }

    const inp = payrollInput || {
      LOPDays: 0,
      overtimeHours: 0,
      bonus: 0,
      deductions: 0,
      ptOverride: undefined,
      tdsOverride: undefined,
      nonTaxableReimbursement: 0,
    };

    const activeRules = statRules || {
      pfRate: 12.0,
      ptAmount: 250.0,
      tdsRate: 10.0,
      basicPercentage: 50.0,
      hraPercentage: 20.0,
    };

    const rawLop =
      inp.LOPDays !== undefined && inp.LOPDays >= 0
        ? inp.LOPDays
        : attendanceSummary.lopDays;
    const finalLop = isFinite(rawLop) && rawLop >= 0 ? rawLop : 0;

    const fixedBaseSalary = e.salary || 0;
    const divisor = lopPolicy.divisor;
    const dailyRate = fixedBaseSalary / divisor;

    // P10-01 & P10R-01 Remediation: Calculate non-employment days (pre-joining / post-exit)
    const effectiveExitDate =
      exitDate !== undefined ? exitDate : (e as any)?.deletedAt || null;
    const { nonEmploymentDays, preJoiningDays, postExitDays } =
      calculateEmploymentIntervalDays(
        e.joined,
        effectiveExitDate,
        payrollMonth,
      );

    const prorationDeductAmount = Math.min(
      fixedBaseSalary,
      Math.round(dailyRate * nonEmploymentDays),
    );

    const lopDeductAmount = Math.min(
      Math.max(0, fixedBaseSalary - prorationDeductAmount),
      Math.round(dailyRate * finalLop),
    );

    const otPay = calculateOvertimePay(
      fixedBaseSalary,
      inp.overtimeHours || 0,
      attendanceSettings,
    );

    const gross = Math.max(
      0,
      fixedBaseSalary -
        prorationDeductAmount -
        lopDeductAmount +
        otPay +
        (inp.bonus || 0),
    );

    const basicSalary = Math.round(
      gross * ((activeRules.basicPercentage || 50.0) / 100),
    );

    const { components: compSnapshot, totalDeduct: finalDeduct } =
      this.componentCalculator.calculateComponents(
        gross,
        inp.deductions || 0,
        activeRules,
        salaryComponents,
        inp.ptOverride,
        inp.tdsOverride,
      );

    const net =
      Math.max(0, gross - finalDeduct) + (inp.nonTaxableReimbursement || 0);

    return {
      fixedBaseSalary,
      basicSalary,
      gross,
      totalDeduct: finalDeduct,
      net,
      components: compSnapshot,
      lopDeductDays: finalLop,
      lopDeductAmount,
      prorationDays: nonEmploymentDays,
      prorationDeductAmount,
      lopDivisorMode: lopPolicy.mode,
      lopDivisor: divisor,
      otPay,
      workingDays: attendanceSummary.workingDays,
      presentDays: attendanceSummary.presentDays,
      calculationVersion: 2,
    };
  }
}

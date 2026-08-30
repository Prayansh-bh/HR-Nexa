import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { parsePayrollMonth } from '../../../common/utils/date.util';

export interface StatutoryCapsConfig {
  section80C: number;
  section80D: number;
  section80CCD_1B: number;
  section24B: number;
  standardDeductionOld: number;
  standardDeductionNew: number;
}

export const DEFAULT_STATUTORY_CAPS: StatutoryCapsConfig = {
  section80C: 150000, // ₹1.5 Lakhs
  section80D: 75000,  // ₹75,000 total (Self + Parents)
  section80CCD_1B: 50000, // ₹50,000 NPS Voluntary
  section24B: 200000, // ₹2.0 Lakhs Home Loan Interest
  standardDeductionOld: 50000,
  standardDeductionNew: 75000,
};

export interface TaxCalculationBreakdown {
  regime: 'OLD' | 'NEW';
  projectedAnnualGross: number;
  approvedDeductionsTotal: number;
  cappedDeductionsTotal: number;
  standardDeduction: number;
  taxableIncome: number;
  annualTaxBase: number;
  cessAmount: number;
  totalAnnualTaxLiability: number;
  tdsWithheldSoFar: number;
  remainingTaxLiability: number;
  remainingMonthsInFy: number;
  monthlyTdsDeduction: number;
}

@Injectable()
export class TaxCalculationService {
  private readonly logger = new Logger(TaxCalculationService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Enforces backend statutory caps on individual declaration items based on section rules.
   */
  capSectionAmount(section: string, amount: number, caps = DEFAULT_STATUTORY_CAPS): number {
    if (amount <= 0) return 0;
    const cleanSection = section.toUpperCase().trim();

    switch (cleanSection) {
      case '80C':
        return Math.min(amount, caps.section80C);
      case '80D':
        return Math.min(amount, caps.section80D);
      case '80CCD_1B':
      case '80CCD(1B)':
        return Math.min(amount, caps.section80CCD_1B);
      case '24B':
      case '24(B)':
        return Math.min(amount, caps.section24B);
      default:
        return amount; // 80E, 80G eligible values as submitted/approved
    }
  }

  /**
   * Calculate HRA Exemption according to Indian IT Act Section 10(13A).
   */
  calculateHraExemption(
    actualHraReceivedAnnual: number,
    annualBasicSalary: number,
    annualRentPaid: number,
    isMetro = false,
  ): number {
    if (annualRentPaid <= 0 || actualHraReceivedAnnual <= 0) return 0;

    const rentOverTenPercentBasic = Math.max(0, annualRentPaid - 0.10 * annualBasicSalary);
    const percentageBasicCap = (isMetro ? 0.50 : 0.40) * annualBasicSalary;

    return Math.min(actualHraReceivedAnnual, rentOverTenPercentBasic, percentageBasicCap);
  }

  /**
   * Tax Slab Calculation Engine for Indian Financial Years.
   */
  calculateAnnualTaxForRegime(taxableIncome: number, regime: 'OLD' | 'NEW'): { baseTax: number; cess: number; totalTax: number } {
    let baseTax = 0;

    if (regime === 'OLD') {
      // OLD REGIME SLABS
      if (taxableIncome <= 250000) {
        baseTax = 0;
      } else if (taxableIncome <= 500000) {
        baseTax = (taxableIncome - 250000) * 0.05;
        // Section 87A rebate for Old Regime (taxable income <= ₹500,000)
        if (taxableIncome <= 500000) {
          baseTax = 0;
        }
      } else if (taxableIncome <= 1000000) {
        baseTax = 12500 + (taxableIncome - 500000) * 0.20;
      } else {
        baseTax = 112500 + (taxableIncome - 1000000) * 0.30;
      }
    } else {
      // NEW REGIME SLABS (FY 2024-25 / 2025-26 / 2026-27)
      if (taxableIncome <= 300000) {
        baseTax = 0;
      } else if (taxableIncome <= 700000) {
        baseTax = (taxableIncome - 300000) * 0.05;
        // Section 87A rebate for New Regime (taxable income <= ₹700,000)
        if (taxableIncome <= 700000) {
          baseTax = 0;
        }
      } else if (taxableIncome <= 1000000) {
        baseTax = 20000 + (taxableIncome - 700000) * 0.10;
      } else if (taxableIncome <= 1200000) {
        baseTax = 50000 + (taxableIncome - 1000000) * 0.15;
      } else if (taxableIncome <= 1500000) {
        baseTax = 80000 + (taxableIncome - 1200000) * 0.20;
      } else {
        baseTax = 140000 + (taxableIncome - 1500000) * 0.30;
      }
    }

    baseTax = Math.round(baseTax);
    const cess = Math.round(baseTax * 0.04); // 4% Health & Education Cess
    const totalTax = baseTax + cess;

    return { baseTax, cess, totalTax };
  }

  /**
   * Determines the remaining months in the active Fiscal Year given a target payroll month (YYYY-MM).
   */
  getRemainingMonthsInFiscalYear(monthStr: string, fyStartDate: Date): number {
    const { monthNum: month } = parsePayrollMonth(monthStr);
    // FY starts in April (month 4) and ends in March (month 3 of next calendar year)
    const fyStartMonth = fyStartDate.getMonth() + 1; // 1-indexed

    // Calculate month index within FY (1 for April, 12 for March)
    let fyMonthIndex = 0;
    if (month >= fyStartMonth) {
      fyMonthIndex = month - fyStartMonth + 1;
    } else {
      fyMonthIndex = 12 - fyStartMonth + 1 + month;
    }

    const remainingMonths = Math.max(1, 12 - fyMonthIndex + 1);
    return remainingMonths;
  }

  /**
   * Master Method: Computes authoritative monthly TDS deduction for an employee.
   */
  async computeEmployeeMonthlyTds(
    companyId: string,
    employeeId: string,
    fiscalYearId: string,
    monthlyGross: number,
    payrollMonthStr: string,
  ): Promise<TaxCalculationBreakdown> {
    const projectedAnnualGross = Math.round(monthlyGross * 12);

    // 1. Fetch Fiscal Year details
    const fy = await (this.prisma as any).fiscalYear.findFirst({
      where: { id: fiscalYearId, companyId, deletedAt: null },
    });
    const fyStartDate = fy ? new Date(fy.startDate) : new Date(`${payrollMonthStr.slice(0, 4)}-04-01`);
    const remainingMonthsInFy = this.getRemainingMonthsInFiscalYear(payrollMonthStr, fyStartDate);

    // 2. Query Approved Tax Declaration for employee, tenant, and fiscal year
    const decl = await (this.prisma as any).taxDeclaration.findFirst({
      where: {
        companyId,
        employeeId,
        fiscalYearId,
        status: 'APPROVED',
      },
      include: {
        items: true,
      },
    });

    let regime: 'OLD' | 'NEW' = decl ? decl.regime : 'NEW';
    let approvedDeductionsTotal = 0;
    let cappedDeductionsTotal = 0;

    if (decl && decl.items && Array.isArray(decl.items)) {
      for (const item of decl.items) {
        const approvedAmt = Number(item.approvedAmount) || 0;
        if (approvedAmt > 0) {
          approvedDeductionsTotal += approvedAmt;
          const cappedAmt = this.capSectionAmount(item.section, approvedAmt);
          cappedDeductionsTotal += cappedAmt;
        }
      }
    }

    // Deductions apply ONLY under OLD regime (except Standard Deduction)
    const eligibleDeductions = regime === 'OLD' ? cappedDeductionsTotal : 0;
    const standardDeduction = regime === 'OLD' ? DEFAULT_STATUTORY_CAPS.standardDeductionOld : DEFAULT_STATUTORY_CAPS.standardDeductionNew;

    const taxableIncome = Math.max(0, projectedAnnualGross - eligibleDeductions - standardDeduction);

    // 3. Compute Annual Tax Liability
    const taxResult = this.calculateAnnualTaxForRegime(taxableIncome, regime);

    // 4. Query TDS Already Withheld in current Fiscal Year from historical payroll records
    const previousPayrolls = await (this.prisma as any).payroll.findMany({
      where: {
        companyId,
        employeeId,
        status: { in: ['PAID', 'APPROVED', 'LOCKED', 'PAYMENT_INITIATED'] },
        month: { not: payrollMonthStr },
      },
      select: {
        components: true,
      },
    });

    let tdsWithheldSoFar = 0;
    if (previousPayrolls && previousPayrolls.length > 0) {
      for (const pr of previousPayrolls) {
        if (pr.components && Array.isArray(pr.components)) {
          const tdsComp = pr.components.find((c: any) => c.name === 'TDS' || c.name === 'Tax Deducted at Source');
          if (tdsComp && typeof tdsComp.amount === 'number') {
            tdsWithheldSoFar += tdsComp.amount;
          }
        }
      }
    }

    // 5. Remaining Tax Liability & Monthly Allocation
    const remainingTaxLiability = Math.max(0, taxResult.totalTax - tdsWithheldSoFar);
    const monthlyTdsDeduction = Math.round(remainingTaxLiability / remainingMonthsInFy);

    return {
      regime,
      projectedAnnualGross,
      approvedDeductionsTotal,
      cappedDeductionsTotal,
      standardDeduction,
      taxableIncome,
      annualTaxBase: taxResult.baseTax,
      cessAmount: taxResult.cess,
      totalAnnualTaxLiability: taxResult.totalTax,
      tdsWithheldSoFar,
      remainingTaxLiability,
      remainingMonthsInFy,
      monthlyTdsDeduction,
    };
  }
}

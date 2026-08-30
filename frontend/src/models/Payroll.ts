export type { SalaryComponent, PayrollInputRecord, LopDivisorMode, SalarySlip } from "../types/payroll";

export type PayrollSummary = {
  month: string;
  processedCount: number;
  totalPayout: number;
};

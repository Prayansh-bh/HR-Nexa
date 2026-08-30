export type PayrollStatus =
  | "DRAFT"
  | "CALCULATED"
  | "APPROVED"
  | "LOCKED"
  | "PAYMENT_INITIATED"
  | "PAID";

export type PayrollRecord = {
  id: string;
  employeeId: string;
  month: string;
  payDate: string;
  basicSalary: number;
  allowances: number;
  deductions: number;
  netSalary: number;
  status: PayrollStatus | string;
  warnings?: string;
  payslipPath?: string;
};

export type PayrollSummary = {
  month: string;
  totalRecords: number;
  totalGross: number;
  totalDeductions: number;
  totalNetPayable: number;
  statusBreakdown: Record<string, number>;
};

export type ProcessPayrollPayload = {
  employeeId: string;
  month: string;
  payDate: string;
  basicSalary: number;
  allowances: number;
  deductions: number;
};

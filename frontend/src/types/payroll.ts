export type LopDivisorMode = "CALENDAR_DAYS" | "FIXED_26" | "WORKING_DAYS";

export type SalaryComponent = {
  id: string;
  name: string;
  type: "earning" | "deduction";
  amount: number;
};

export type PayrollInputRecord = {
  employeeId: string;
  month: string;
  lopDays: number;
  overtimeHours: number;
  bonus: number;
};

export type SalarySlip = {
  id: string;
  employeeId: string;
  employeeName: string;
  month: string;
  fixedBaseSalary: number;
  basicSalary: number;
  gross: number;
  lopDays: number;
  lopDeductAmount: number;
  lopDivisorMode: LopDivisorMode;
  lopDivisor: number;
  deductions: number;
  net: number;
  status: string;
  generatedAt: string;
  components?: any[];
  adjustments?: any;
  calculationVersion: number;
};

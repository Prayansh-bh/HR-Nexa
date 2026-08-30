import { create } from "zustand";
import { payrollService } from "../services/payroll.service";

export interface PayrollStore {
  salaryComponents: any[];
  salarySlips: any[];
  payrollHistory: any[];
  payrollInputs: Record<
    string,
    { LOPDays: number; overtimeHours: number; bonus: number; deductions: number; remarks: string }
  >;
  isLoading: boolean;
  error: string | null;

  setSalaryComponents: (update: any[] | ((prev: any[]) => any[])) => void;
  setSalarySlips: (update: any[] | ((prev: any[]) => any[])) => void;
  setPayrollHistory: (update: any[] | ((prev: any[]) => any[])) => void;
  setPayrollInputs: (update: any | ((prev: any) => any)) => void;

  fetchPayroll: (month?: string, employeeId?: string) => Promise<void>;
  processPayrollRecord: (record: any) => Promise<any>;
  updatePayrollStatus: (id: string, status: "Draft" | "Processed" | "Paid") => Promise<void>;
}

export const usePayrollStore = create<PayrollStore>()((set, get) => ({
  salaryComponents: [
    { name: "Basic Salary", type: "Earning", value: "50% of CTC" },
    { name: "HRA", type: "Earning", value: "40% of Basic" },
    { name: "Special Allowance", type: "Earning", value: "Flexible" },
    { name: "Provident Fund", type: "Deduction", value: "12% of Basic" },
    { name: "Professional Tax", type: "Deduction", value: "₹250/mo" },
    { name: "TDS", type: "Deduction", value: "As per slab" },
  ],
  salarySlips: [],
  payrollHistory: [],
  payrollInputs: {},
  isLoading: false,
  error: null,

  setSalaryComponents: (update) =>
    set((state) => ({
      salaryComponents: typeof update === "function" ? update(state.salaryComponents) : update,
    })),
  setSalarySlips: (update) =>
    set((state) => ({
      salarySlips: typeof update === "function" ? update(state.salarySlips) : update,
    })),
  setPayrollHistory: (update) =>
    set((state) => ({
      payrollHistory: typeof update === "function" ? update(state.payrollHistory) : update,
    })),
  setPayrollInputs: (update) =>
    set((state) => ({
      payrollInputs: typeof update === "function" ? update(state.payrollInputs) : update,
    })),

  fetchPayroll: async (month, employeeId) => {
    set({ isLoading: true, error: null });
    try {
      const data = await payrollService.getPayroll(month, employeeId);
      const slips = Array.isArray(data)
        ? data
        : Array.isArray((data as any)?.data)
          ? (data as any).data
          : [];
      set({ salarySlips: slips, isLoading: false });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : "Failed to fetch payroll records",
        isLoading: false,
      });
    }
  },
  processPayrollRecord: async (record) => {
    const res = await payrollService.processPayroll(record);
    await get().fetchPayroll();
    return res;
  },
  updatePayrollStatus: async (id, status) => {
    await payrollService.updatePayrollStatus(id, status);
    await get().fetchPayroll();
  },
}));

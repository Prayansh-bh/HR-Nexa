import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PayrollPage } from "../features/payroll/pages/PayrollPage";
import { payrollService } from "../services/payroll.service";
import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("../services/payroll.service", () => ({
  payrollService: {
    calculatePayroll: vi.fn().mockResolvedValue([
      {
        employeeId: "emp-1",
        fixedBaseSalary: 50000,
        basicSalary: 25000,
        gross: 50000,
        deductions: 5000,
        net: 45000,
        lopDays: 0,
        lopDeductAmount: 0,
        warnings: [],
      },
    ]),
    generatePayroll: vi.fn().mockResolvedValue({ status: "DRAFT", count: 1 }),
    processPayroll: vi.fn().mockResolvedValue({ status: "APPROVED", count: 1 }),
  },
}));

vi.mock("../hooks/usePayrollQuery", () => ({
  usePayrollQuery: vi.fn().mockReturnValue({ data: [], slips: [] }),
}));

vi.mock("../hooks/useEmployeesQuery", () => ({
  useEmployeesQuery: vi.fn().mockReturnValue({
    data: [{ id: "emp-1", name: "Alice Smith", salary: 50000, department: "Engineering" }],
    employees: [{ id: "emp-1", name: "Alice Smith", salary: 50000, department: "Engineering" }],
  }),
}));

describe("PayrollPage Two-Stage UI Mode Separation", () => {
  let queryClient: QueryClient;

  const mockHrAdmin = {
    id: "user-hr-1",
    name: "HR Admin",
    role: "HRAdmin",
    permissions: ["payroll:process:view", "payroll:process:generate", "payroll:slips:view"],
  };

  const mockAccountant = {
    id: "user-acc-1",
    name: "Accountant",
    role: "Accountant",
    permissions: ["payroll:process:view", "payroll:process:run", "payroll:process:lock", "payroll:process:reopen"],
  };

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    vi.clearAllMocks();
  });

  it("19. Generate Mode renders 'Generate Payroll' header and draft preparation workflow", async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <PayrollPage
          mode="generate"
          user={mockHrAdmin}
          toast={vi.fn()}
          triggerConfirm={vi.fn()}
        />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("Generate Payroll")).toBeInTheDocument();
      expect(
        screen.getByText("Prepare and generate draft monthly payroll (Sync Attendance & LOP -> Preview -> Save Draft).")
      ).toBeInTheDocument();
      expect(screen.getByText("Save Draft")).toBeInTheDocument();
    });
  });

  it("20. Process Mode renders 'Process Payroll' header and financial approval workflow", async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <PayrollPage
          mode="process"
          user={mockAccountant}
          toast={vi.fn()}
          triggerConfirm={vi.fn()}
        />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("Process Payroll")).toBeInTheDocument();
      expect(
        screen.getByText("Review draft payroll, verify statutory deductions, approve and lock period.")
      ).toBeInTheDocument();
      expect(screen.getByText("Review Draft")).toBeInTheDocument();
    });
  });
});

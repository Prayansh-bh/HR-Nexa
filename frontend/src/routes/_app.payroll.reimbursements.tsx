import { createFileRoute } from "@tanstack/react-router";
import React from "react";
import { AccountantReimbursePage } from "../features/payroll/pages/AccountantReimbursePage";
import { EmployeeExpensesPage } from "../features/employees/pages/EmployeeExpensesPage";
import { useToast, useLocalStorage } from "../hooks";
import { ProtectedRoute, PERMISSIONS } from "../auth";
import { AuthUser } from "../types";

export const Route = createFileRoute("/_app/payroll/reimbursements")({
  component: ReimbursementsRouteComponent,
});

function ReimbursementsRouteComponent() {
  const toast = useToast();
  const [user] = useLocalStorage<AuthUser | null>("hrms.user", null);

  const canManageExpenses =
    user?.role === "Accountant" ||
    user?.role === "HRAdmin" ||
    user?.role === "SuperAdmin" ||
    user?.permissions?.includes("payroll:process:view") ||
    user?.permissions?.includes("expenses:claims:approve") ||
    user?.permissions?.includes("expenses:claims:manage");

  if (canManageExpenses) {
    return (
      <ProtectedRoute permission={PERMISSIONS.EXPENSES_VIEW}>
        <AccountantReimbursePage toast={toast.push} />
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute permission={PERMISSIONS.EXPENSES_VIEW}>
      <EmployeeExpensesPage toast={toast.push} />
    </ProtectedRoute>
  );
}

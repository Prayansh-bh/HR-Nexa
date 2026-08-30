import { createFileRoute } from "@tanstack/react-router";
import React from "react";
import { PayrollInputsPage } from "../features/payroll/pages/PayrollPage";
import { useToast, useShellActions } from "../hooks";
import { ProtectedRoute, PERMISSIONS } from "../auth";

export const Route = createFileRoute("/_app/payroll/coordination")({
  component: PayrollInputsComponent,
});

function PayrollInputsComponent() {
  const toast = useToast();
  const actions = useShellActions();

  return (
    <ProtectedRoute permission={PERMISSIONS.PAYROLL_PROCESS_VIEW}>
      <PayrollInputsPage toast={toast.push} />
    </ProtectedRoute>
  );
}

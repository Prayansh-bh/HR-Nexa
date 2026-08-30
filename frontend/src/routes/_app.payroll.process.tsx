import { createFileRoute } from "@tanstack/react-router";
import React from "react";
import { PayrollPage } from "../features/payroll/pages/PayrollPage";
import { useLocalStorage, useToast, useShellActions } from "../hooks";
import { AuthUser } from "../types";
import { ProtectedRoute, PERMISSIONS } from "../auth";

export const Route = createFileRoute("/_app/payroll/process")({
  component: PayrollProcessComponent,
});

function PayrollProcessComponent() {
  const [user] = useLocalStorage<AuthUser | null>("hrms.user", null);
  const toast = useToast();
  const actions = useShellActions();

  if (!user) return null;

  return (
    <ProtectedRoute permission={PERMISSIONS.PAYROLL_PROCESS_RUN}>
      <PayrollPage
        mode="process"
        sub="payroll.process"
        user={user}
        toast={toast.push}
        triggerConfirm={actions.triggerConfirm}
      />
    </ProtectedRoute>
  );
}

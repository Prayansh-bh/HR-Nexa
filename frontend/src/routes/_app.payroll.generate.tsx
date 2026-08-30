import { createFileRoute } from "@tanstack/react-router";
import React from "react";
import { PayrollPage } from "../features/payroll/pages/PayrollPage";
import { useLocalStorage, useToast, useShellActions } from "../hooks";
import { AuthUser } from "../types";
import { ProtectedRoute, PERMISSIONS } from "../auth";

export const Route = createFileRoute("/_app/payroll/generate")({
  component: PayrollGenerateComponent,
});

function PayrollGenerateComponent() {
  const [user] = useLocalStorage<AuthUser | null>("hrms.user", null);
  const toast = useToast();
  const actions = useShellActions();

  if (!user) return null;

  return (
    <ProtectedRoute permission={PERMISSIONS.PAYROLL_PROCESS_GENERATE}>
      <PayrollPage
        mode="generate"
        sub="payroll.generate"
        user={user}
        toast={toast.push}
        triggerConfirm={actions.triggerConfirm}
      />
    </ProtectedRoute>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import React, { Suspense } from "react";
import { useLocalStorage, useToast, useShellActions } from "../hooks";
import { AuthUser } from "../types";
import { ProtectedRoute, PERMISSIONS } from "../auth";

const PayrollPage = React.lazy(() =>
  import("../features/payroll/pages/PayrollPage").then((m) => ({ default: m.PayrollPage })),
);

export const Route = createFileRoute("/_app/payroll/")({
  component: PayrollIndexComponent,
});

function PayrollIndexComponent() {
  const [user] = useLocalStorage<AuthUser | null>("hrms.user", null);
  const toast = useToast();
  const actions = useShellActions();

  if (!user) return null;

  return (
    <ProtectedRoute permission={PERMISSIONS.PAYROLL_PROCESS_VIEW}>
      <Suspense
        fallback={
          <div className="p-8 text-center text-sm text-muted-foreground animate-pulse">
            Loading Payroll...
          </div>
        }
      >
        <PayrollPage
          sub="payroll.structure"
          user={user}
          toast={toast.push}
          triggerConfirm={actions.triggerConfirm}
        />
      </Suspense>
    </ProtectedRoute>
  );
}

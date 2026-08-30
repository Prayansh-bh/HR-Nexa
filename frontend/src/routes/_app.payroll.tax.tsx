import { createFileRoute } from "@tanstack/react-router";
import React from "react";
import { AccountantTaxDeclPage } from "../features/payroll/pages/AccountantTaxDeclPage";
import { EmployeeTaxDeclPage } from "../features/payroll/pages/EmployeeTaxDeclPage";
import { useToast, useShellActions } from "../hooks";
import { ProtectedRoute, PERMISSIONS, useHasPermission } from "../auth";

export const Route = createFileRoute("/_app/payroll/tax")({
  component: TaxDeclRouteComponent,
});

function TaxDeclRouteComponent() {
  const toast = useToast();
  const canManage = useHasPermission(PERMISSIONS.TAX_DECLARATIONS_MANAGE);

  if (canManage) {
    return (
      <ProtectedRoute permission={PERMISSIONS.TAX_DECLARATIONS_MANAGE}>
        <AccountantTaxDeclPage toast={toast.push} />
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute permission={PERMISSIONS.TAX_DECLARATIONS_VIEW}>
      <EmployeeTaxDeclPage toast={toast.push} />
    </ProtectedRoute>
  );
}

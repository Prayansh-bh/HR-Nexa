import { createFileRoute } from "@tanstack/react-router";
import React from "react";
import { StatutoryCompliancePage } from "../features/payroll/pages/StatutoryCompliancePage";
import { ProtectedRoute, PERMISSIONS } from "../auth";

export const Route = createFileRoute("/_app/payroll/compliance")({
  component: StatutoryComplianceComponent,
});

function StatutoryComplianceComponent() {
  return (
    <ProtectedRoute permission={PERMISSIONS.PAYROLL_STATUTORY_VIEW}>
      <StatutoryCompliancePage />
    </ProtectedRoute>
  );
}

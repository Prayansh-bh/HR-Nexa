import { createFileRoute } from "@tanstack/react-router";
import React from "react";
import { HRAnalyticsPage } from "../../../features/reports";
import { ProtectedRoute, PERMISSIONS } from "../../../auth";

export const Route = createFileRoute("/_app/reports/hr-analytics")({
  component: HRAnalyticsRouteComponent,
});

function HRAnalyticsRouteComponent() {
  return (
    <ProtectedRoute permission={PERMISSIONS.REPORTS_PAYROLL_VIEW}>
      <HRAnalyticsPage />
    </ProtectedRoute>
  );
}

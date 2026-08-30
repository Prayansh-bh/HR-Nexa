import { createFileRoute } from "@tanstack/react-router";
import React from "react";
import { ManagerDprPage } from "../features/dpr/pages/ManagerDprPage";
import { ProtectedRoute, PERMISSIONS } from "../auth";

export const Route = createFileRoute("/_app/dpr/admin")({
  component: DprAdminRouteComponent,
});

function DprAdminRouteComponent() {
  return (
    <ProtectedRoute permission={PERMISSIONS.DPR_MANAGE}>
      <ManagerDprPage
        title="DPR Management"
        subtitle="Review and monitor Daily Progress Reports across your organization."
      />
    </ProtectedRoute>
  );
}

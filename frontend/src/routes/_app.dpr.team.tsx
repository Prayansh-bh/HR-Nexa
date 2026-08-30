import { createFileRoute } from "@tanstack/react-router";
import React from "react";
import { ManagerDprPage } from "../features/dpr/pages/ManagerDprPage";
import { ProtectedRoute, PERMISSIONS } from "../auth";

export const Route = createFileRoute("/_app/dpr/team")({
  component: DprTeamRouteComponent,
});

function DprTeamRouteComponent() {
  return (
    <ProtectedRoute permission={PERMISSIONS.DPR_APPROVE}>
      <ManagerDprPage
        title="Team Progress Reviews"
        subtitle="Review and approve Daily Progress Reports submitted by your team members."
      />
    </ProtectedRoute>
  );
}

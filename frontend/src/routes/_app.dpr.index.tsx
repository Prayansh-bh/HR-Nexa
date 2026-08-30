import { createFileRoute } from "@tanstack/react-router";
import React from "react";
import { EmployeeDprPage } from "../features/dpr/pages/EmployeeDprPage";
import { ProtectedRoute, PERMISSIONS } from "../auth";

export const Route = createFileRoute("/_app/dpr/")({
  component: DprIndexRouteComponent,
});

function DprIndexRouteComponent() {
  return (
    <ProtectedRoute permission={PERMISSIONS.DPR_VIEW}>
      <EmployeeDprPage />
    </ProtectedRoute>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import React from "react";
import { PerformanceConfigPage } from "../features/performance";
import { useToast } from "../hooks";
import { ProtectedRoute, PERMISSIONS } from "../auth";

export const Route = createFileRoute("/_app/performance/cycles")({
  component: PerformanceCyclesComponent,
});

function PerformanceCyclesComponent() {
  const toast = useToast();

  return (
    <ProtectedRoute permission={PERMISSIONS.PERFORMANCE_CYCLES_MANAGE}>
      <PerformanceConfigPage toast={toast.push} />
    </ProtectedRoute>
  );
}

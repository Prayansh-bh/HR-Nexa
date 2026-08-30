import { createFileRoute } from "@tanstack/react-router";
import React, { Suspense } from "react";
import { SystemMonitoringPage } from "../features/super-admin/pages/SystemMonitoringPage";

export const Route = createFileRoute("/_app/monitoring")({
  component: MonitoringRouteComponent,
});

function MonitoringRouteComponent() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-center text-sm text-slate-400 animate-pulse">
          Loading System Monitoring...
        </div>
      }
    >
      <SystemMonitoringPage />
    </Suspense>
  );
}

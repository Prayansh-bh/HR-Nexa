import { createFileRoute } from "@tanstack/react-router";
import React, { Suspense } from "react";
import { SuperAdminReportsPage } from "../features/super-admin/pages/SuperAdminReportsPage";
import { toast } from "../hooks/useToast";

export const Route = createFileRoute("/_app/reports")({
  component: ReportsRouteComponent,
});

function ReportsRouteComponent() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-center text-sm text-slate-400 animate-pulse">
          Loading Platform Reports...
        </div>
      }
    >
      <SuperAdminReportsPage toast={toast} />
    </Suspense>
  );
}

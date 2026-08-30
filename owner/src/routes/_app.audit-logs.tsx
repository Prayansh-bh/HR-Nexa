import { createFileRoute } from "@tanstack/react-router";
import React, { Suspense } from "react";
import { AuditLogsPage } from "../features/super-admin/pages/AuditLogsPage";
import { toast } from "../hooks/useToast";

export const Route = createFileRoute("/_app/audit-logs")({
  component: AuditLogsRouteComponent,
});

function AuditLogsRouteComponent() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-center text-sm text-slate-400 animate-pulse">
          Loading Audit Logs...
        </div>
      }
    >
      <AuditLogsPage toast={toast} />
    </Suspense>
  );
}

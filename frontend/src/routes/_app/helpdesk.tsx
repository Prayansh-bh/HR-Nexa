import { createFileRoute } from "@tanstack/react-router";
import React, { Suspense } from "react";
import { EmployeeHelpdeskPage } from "../../features/employees/pages/EmployeeHelpdeskPage";
import { ProtectedRoute, PERMISSIONS } from "../../auth";
import { useToast } from "../../hooks";

export const Route = createFileRoute("/_app/helpdesk")({
  component: HelpdeskRouteComponent,
});

function HelpdeskRouteComponent() {
  const toast = useToast();

  return (
    <ProtectedRoute permission={PERMISSIONS.SUPPORT_TICKETS_VIEW}>
      <Suspense
        fallback={
          <div className="p-8 text-center text-sm text-muted-foreground animate-pulse">
            Loading Helpdesk...
          </div>
        }
      >
        <EmployeeHelpdeskPage toast={toast.push} />
      </Suspense>
    </ProtectedRoute>
  );
}

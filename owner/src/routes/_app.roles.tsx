import { createFileRoute } from "@tanstack/react-router";
import React, { Suspense } from "react";
import { RolePermissionMatrixTable } from "../features/settings/components/RolePermissionMatrixTable";
import { toast } from "../hooks/useToast";

export const Route = createFileRoute("/_app/roles")({
  component: RolesRouteComponent,
});

function RolesRouteComponent() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-center text-sm text-slate-400 animate-pulse">
          Loading Roles & Permissions...
        </div>
      }
    >
      <div className="space-y-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Roles &amp; Permission Matrix</h1>
          <p className="text-sm text-muted-foreground">
            Define system-wide and tenant-level RBAC authorization rules
          </p>
        </div>
        <RolePermissionMatrixTable toast={toast} />
      </div>
    </Suspense>
  );
}

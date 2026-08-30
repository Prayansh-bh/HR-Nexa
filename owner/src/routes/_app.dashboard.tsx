import { createFileRoute } from "@tanstack/react-router";
import React, { Suspense } from "react";
import { SuperAdminDashboardPage } from "../features/super-admin/pages/SuperAdminDashboardPage";
import { useOwnerAuthStore } from "../store/authStore";
import { toast } from "../hooks/useToast";

export const Route = createFileRoute("/_app/dashboard")({
  component: OwnerDashboardRouteComponent,
});

function OwnerDashboardRouteComponent() {
  const setUser = useOwnerAuthStore((s) => s.setUser);

  return (
    <Suspense
      fallback={
        <div className="p-8 text-center text-sm text-slate-400 animate-pulse">
          Loading Platform Owner Dashboard...
        </div>
      }
    >
      <SuperAdminDashboardPage toast={toast} setUser={setUser} />
    </Suspense>
  );
}

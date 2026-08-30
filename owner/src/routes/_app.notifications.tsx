import { createFileRoute } from "@tanstack/react-router";
import React, { Suspense } from "react";
import { SuperAdminNotificationsPage } from "../features/super-admin/pages/SuperAdminNotificationsPage";
import { toast } from "../hooks/useToast";

export const Route = createFileRoute("/_app/notifications")({
  component: NotificationsRouteComponent,
});

function NotificationsRouteComponent() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-center text-sm text-slate-400 animate-pulse">
          Loading Notifications...
        </div>
      }
    >
      <SuperAdminNotificationsPage toast={toast} />
    </Suspense>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import React, { Suspense } from "react";
import { GlobalSettingsPage } from "../features/settings/pages/GlobalSettingsPage";
import { toast } from "../hooks/useToast";

export const Route = createFileRoute("/_app/settings")({
  component: SettingsRouteComponent,
});

function SettingsRouteComponent() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-center text-sm text-slate-400 animate-pulse">
          Loading Global Settings...
        </div>
      }
    >
      <GlobalSettingsPage toast={toast} />
    </Suspense>
  );
}

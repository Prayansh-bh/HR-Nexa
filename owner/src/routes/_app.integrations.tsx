import { createFileRoute } from "@tanstack/react-router";
import React, { Suspense } from "react";
import { PlatformIntegrationsPage } from "../features/settings/pages/PlatformIntegrationsPage";

export const Route = createFileRoute("/_app/integrations")({
  component: IntegrationsRouteComponent,
});

function IntegrationsRouteComponent() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-center text-sm text-slate-400 animate-pulse">
          Loading Platform Integrations...
        </div>
      }
    >
      <PlatformIntegrationsPage />
    </Suspense>
  );
}

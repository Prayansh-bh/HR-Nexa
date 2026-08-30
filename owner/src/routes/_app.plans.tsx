import { createFileRoute } from "@tanstack/react-router";
import React, { Suspense } from "react";
import { PlanManagementPage } from "../features/settings/pages/PlanManagementPage";
import { toast } from "../hooks/useToast";

export const Route = createFileRoute("/_app/plans")({
  component: PlansRouteComponent,
});

function PlansRouteComponent() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-center text-sm text-slate-400 animate-pulse">
          Loading Plan Management...
        </div>
      }
    >
      <PlanManagementPage toast={toast} />
    </Suspense>
  );
}

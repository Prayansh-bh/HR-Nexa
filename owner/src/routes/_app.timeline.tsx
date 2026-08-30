import { createFileRoute } from "@tanstack/react-router";
import React, { Suspense } from "react";
import { ActivityTimelinePage } from "../features/super-admin/pages/ActivityTimelinePage";

export const Route = createFileRoute("/_app/timeline")({
  component: TimelineRouteComponent,
});

function TimelineRouteComponent() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-center text-sm text-slate-400 animate-pulse">
          Loading Activity Timeline...
        </div>
      }
    >
      <ActivityTimelinePage />
    </Suspense>
  );
}

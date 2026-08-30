import { createFileRoute } from "@tanstack/react-router";
import React, { Suspense } from "react";
import { RecruitmentOverviewPage } from "../features/recruitment/pages/RecruitmentOverviewPage";

export const Route = createFileRoute("/_app/recruitment")({
  component: RecruitmentRouteComponent,
});

function RecruitmentRouteComponent() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-center text-sm text-slate-400 animate-pulse">
          Loading Recruitment Overview...
        </div>
      }
    >
      <RecruitmentOverviewPage />
    </Suspense>
  );
}

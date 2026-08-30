import { createFileRoute } from "@tanstack/react-router";
import React, { Suspense } from "react";
import { useToast } from "../hooks";
import { ProtectedRoute, PERMISSIONS } from "../auth";

const RecruitmentPage = React.lazy(() =>
  import("../features/recruitment").then((m) => ({ default: m.RecruitmentPage })),
);

export const Route = createFileRoute("/_app/recruitment")({
  component: RecruitmentRouteComponent,
});

function RecruitmentRouteComponent() {
  const toast = useToast();

  return (
    <ProtectedRoute permission={PERMISSIONS.RECRUITMENT_JOBS_VIEW}>
      <Suspense
        fallback={
          <div className="p-8 text-center text-sm text-muted-foreground animate-pulse">
            Loading Recruitment...
          </div>
        }
      >
        <RecruitmentPage toast={toast.push} />
      </Suspense>
    </ProtectedRoute>
  );
}

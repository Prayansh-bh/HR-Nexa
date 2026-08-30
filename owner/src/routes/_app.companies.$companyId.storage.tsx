import { createFileRoute } from "@tanstack/react-router";
import React, { Suspense } from "react";
import { CompanyManagementPage } from "@/features/settings/pages/CompanyManagementPage";

export const Route = createFileRoute("/_app/companies/$companyId/storage")({
  component: CompanyStorageRouteComponent,
});

function CompanyStorageRouteComponent() {
  const { companyId } = Route.useParams();
  return (
    <Suspense
      fallback={
        <div className="p-8 text-center text-sm text-slate-400 animate-pulse">
          Loading Company Storage...
        </div>
      }
    >
      <CompanyManagementPage initialCompanyId={companyId} defaultTab="storage" />
    </Suspense>
  );
}

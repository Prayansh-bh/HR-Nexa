import { createFileRoute } from "@tanstack/react-router";
import React, { Suspense } from "react";
import { CompanyManagementPage } from "../features/settings/pages/CompanyManagementPage";
import { toast } from "../hooks/useToast";

export const Route = createFileRoute("/_app/companies/")({
  component: CompaniesRouteComponent,
});

function CompaniesRouteComponent() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-center text-sm text-slate-400 animate-pulse">
          Loading Company Management...
        </div>
      }
    >
      <CompanyManagementPage toast={toast} />
    </Suspense>
  );
}

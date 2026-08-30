import { createFileRoute } from "@tanstack/react-router";
import React, { Suspense } from "react";
import { SupportCenterPage } from "../features/super-admin/pages/SupportCenterPage";
import { toast } from "../hooks/useToast";

export const Route = createFileRoute("/_app/support")({
  component: SupportRouteComponent,
});

function SupportRouteComponent() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-center text-sm text-slate-400 animate-pulse">
          Loading Support Center...
        </div>
      }
    >
      <SupportCenterPage toast={toast} />
    </Suspense>
  );
}

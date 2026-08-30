import { createFileRoute } from "@tanstack/react-router";
import React, { Suspense } from "react";
import { BillingPaymentsPage } from "../features/super-admin/pages/BillingPaymentsPage";
import { toast } from "../hooks/useToast";

export const Route = createFileRoute("/_app/billing")({
  component: BillingRouteComponent,
});

function BillingRouteComponent() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-center text-sm text-slate-400 animate-pulse">
          Loading Invoices & Billing...
        </div>
      }
    >
      <BillingPaymentsPage toast={toast} />
    </Suspense>
  );
}

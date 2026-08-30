import { createFileRoute } from "@tanstack/react-router";
import React, { Suspense } from "react";
import { SubscriptionManagementPage } from "../features/settings/pages/SubscriptionManagementPage";
import { toast } from "../hooks/useToast";

export const Route = createFileRoute("/_app/subscriptions")({
  component: SubscriptionsRouteComponent,
});

function SubscriptionsRouteComponent() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-center text-sm text-slate-400 animate-pulse">
          Loading Subscription Management...
        </div>
      }
    >
      <SubscriptionManagementPage toast={toast} />
    </Suspense>
  );
}

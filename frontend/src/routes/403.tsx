import { createFileRoute } from "@tanstack/react-router";
import React from "react";
import { ShieldAlert, Sparkles, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/403")({
  component: ForbiddenPage,
});

function ForbiddenPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-8 shadow-[var(--shadow-soft)] text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500">
          <ShieldAlert className="h-8 w-8" />
        </div>

        <h1 className="text-2xl font-bold tracking-tight text-foreground">Feature Unavailable</h1>

        <p className="mt-3 text-sm text-muted-foreground">
          This feature is locked under your company's current subscription plan. Upgrade your plan
          to unlock advanced functionalities and unlock full capabilities.
        </p>

        <div className="mt-6 rounded-xl bg-muted/50 p-4 border border-border text-left">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-primary" /> What you unlock on PREMIUM:
          </h3>
          <ul className="space-y-1.5 text-xs text-foreground/80">
            <li>• Biometric integration & Geo-Fencing mobile clock-in</li>
            <li>• PF, ESI & Statutory tax compliance structures</li>
            <li>• Role & granular permissions management</li>
            <li>• Dedicated SaaS platform support center</li>
          </ul>
        </div>

        <div className="mt-8 flex flex-col sm:flex-row justify-center gap-3">
          <button
            onClick={() => window.history.back()}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-input bg-background px-4 py-2.5 text-sm font-medium text-foreground transition hover:bg-accent"
          >
            <ArrowLeft className="h-4 w-4" /> Go Back
          </button>

          <a
            href="mailto:support@saas-hrms.com?subject=Subscription Upgrade Request"
            className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow transition hover:bg-primary/95"
          >
            Contact Administrator
          </a>
        </div>
      </div>
    </div>
  );
}

import React from "react";
import { Building2, MapPin, ShieldCheck, Layers, GitFork } from "lucide-react";

const cardCls =
  "rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)] transition hover:shadow-[var(--shadow-elevated)]";

function Badge({ children, tone = "slate" }: { children: React.ReactNode; tone?: string }) {
  const tones: Record<string, string> = {
    slate: "bg-muted text-muted-foreground",
    green: "bg-[color:var(--color-success)]/15 text-[color:var(--color-success)]",
    amber: "bg-[color:var(--color-warning)]/15 text-[color:var(--color-warning)]",
    rose: "bg-destructive/15 text-destructive",
    indigo: "bg-primary/15 text-primary",
    sky: "bg-[color:var(--color-info)]/15 text-[color:var(--color-info)]",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${tones[tone] || tones.slate}`}
    >
      {children}
    </span>
  );
}

export function EntityBranchPage({ toast }: { toast?: (m: string) => void } = {}) {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Multi-Entity & Branch Architecture</h1>
          <p className="text-sm text-muted-foreground">
            Enterprise entity hierarchy, physical branches, and subsidiary governance.
          </p>
        </div>
        <Badge tone="indigo">Enterprise Plan</Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Primary Corporate Entity */}
        <div className={cardCls + " border-primary/40 bg-primary/5"}>
          <div className="flex justify-between items-start">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary text-white font-bold">
              <Building2 size={20} />
            </div>
            <Badge tone="green">Primary HQ</Badge>
          </div>
          <h3 className="text-lg font-bold mt-4">Corporate Headquarters</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Scope: Active Tenant Organization Context
          </p>
          <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground mt-4">
            <ShieldCheck size={14} className="text-primary" /> Authoritative Tenant Root
          </div>
        </div>

        {/* Regional Branch Scope */}
        <div className={cardCls}>
          <div className="flex justify-between items-start">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-muted text-foreground">
              <GitFork size={20} />
            </div>
            <Badge tone="slate">Enterprise Scoped</Badge>
          </div>
          <h3 className="text-lg font-bold mt-4">Regional Business Units</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Location-based attendance & payroll cost-center routing
          </p>
          <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground mt-4">
            <MapPin size={12} /> Multi-region Ingress
          </div>
        </div>

        {/* Subsidiary Architecture */}
        <div className={cardCls}>
          <div className="flex justify-between items-start">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-muted text-foreground">
              <Layers size={20} />
            </div>
            <Badge tone="amber">Roadmap Q4</Badge>
          </div>
          <h3 className="text-lg font-bold mt-4">Subsidiary Legal Entities</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Separate GSTIN, PAN, and independent payroll runs
          </p>
          <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground mt-4">
            <Layers size={12} /> Consolidated Multi-Entity Ledger
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)]">
        <h3 className="text-base font-bold mb-2">Entity & Branch Administration</h3>
        <p className="text-xs text-muted-foreground leading-relaxed">
          In HR NEXA, organization isolation and data residency are strictly enforced at the tenant level. 
          Multi-entity legal subsidiary segregation and branch cost-center tagging are governed through Enterprise subscription policies. 
          To configure department and designation structures for your current tenant, use the Employee Directory settings.
        </p>
      </div>
    </div>
  );
}

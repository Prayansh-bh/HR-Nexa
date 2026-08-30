import React from "react";
import {
  Building2,
  CreditCard,
  DollarSign,
  HelpCircle,
  MessageSquare,
  Layers,
  ShieldAlert,
  Cpu,
} from "lucide-react";

interface QuickActionsPanelProps {
  onAddCompany: () => void;
  onCreateSub: () => void;
  onAddStandardCompany: () => void;
  onGenInvoice: () => void;
  onOpenTicket: () => void;
  onBroadcastAnno: () => void;
  onManagePlans: () => void;
  onViewAudit: () => void;
  onSysSettings: () => void;
}

export const QuickActionsPanel: React.FC<QuickActionsPanelProps> = ({
  onAddCompany,
  onCreateSub,
  onAddStandardCompany,
  onGenInvoice,
  onOpenTicket,
  onBroadcastAnno,
  onManagePlans,
  onViewAudit,
  onSysSettings,
}) => {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)] space-y-4">
      <h3 className="text-base font-bold flex items-center gap-2 text-foreground">
        <Building2 className="h-5 w-5 text-primary" /> Admin Quick Actions Console
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <button
          onClick={onAddCompany}
          className="p-3 text-left border border-border hover:border-primary hover:text-primary rounded-xl text-xs font-semibold flex items-center gap-2 transition hover:-translate-y-0.5 bg-background"
        >
          <Building2 className="h-4 w-4 text-primary shrink-0" /> Onboard Tenant
        </button>
        <button
          onClick={onCreateSub}
          className="p-3 text-left border border-border hover:border-primary hover:text-primary rounded-xl text-xs font-semibold flex items-center gap-2 transition hover:-translate-y-0.5 bg-background"
        >
          <CreditCard className="h-4 w-4 text-indigo-500 shrink-0" /> Assign Subscription
        </button>
        <button
          onClick={onGenInvoice}
          className="p-3 text-left border border-border hover:border-primary hover:text-primary rounded-xl text-xs font-semibold flex items-center gap-2 transition hover:-translate-y-0.5 bg-background"
        >
          <DollarSign className="h-4 w-4 text-emerald-500 shrink-0" /> Generate Invoice
        </button>
        <button
          onClick={onOpenTicket}
          className="p-3 text-left border border-border hover:border-primary hover:text-primary rounded-xl text-xs font-semibold flex items-center gap-2 transition hover:-translate-y-0.5 bg-background"
        >
          <HelpCircle className="h-4 w-4 text-amber-500 shrink-0" /> Open Ticket
        </button>
        <button
          onClick={onBroadcastAnno}
          className="p-3 text-left border border-border hover:border-primary hover:text-primary rounded-xl text-xs font-semibold flex items-center gap-2 transition hover:-translate-y-0.5 bg-background"
        >
          <MessageSquare className="h-4 w-4 text-sky-500 shrink-0" /> Broadcast Notice
        </button>
        <button
          onClick={onManagePlans}
          className="p-3 text-left border border-border hover:border-primary hover:text-primary rounded-xl text-xs font-semibold flex items-center gap-2 transition hover:-translate-y-0.5 bg-background"
        >
          <Layers className="h-4 w-4 text-purple-500 shrink-0" /> Manage Pricing
        </button>
        <button
          onClick={onViewAudit}
          className="p-3 text-left border border-border hover:border-primary hover:text-primary rounded-xl text-xs font-semibold flex items-center gap-2 transition hover:-translate-y-0.5 bg-background"
        >
          <ShieldAlert className="h-4 w-4 text-rose-500 shrink-0" /> Audit Log Console
        </button>
        <button
          onClick={onSysSettings}
          className="p-3 text-left border border-border hover:border-primary hover:text-primary rounded-xl text-xs font-semibold flex items-center gap-2 transition hover:-translate-y-0.5 bg-background"
        >
          <Cpu className="h-4 w-4 text-slate-500 shrink-0" /> System Settings
        </button>
      </div>
    </div>
  );
};

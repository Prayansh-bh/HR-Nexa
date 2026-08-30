import React from "react";
import {
  Building2,
  CheckCircle,
  Sparkles,
  XCircle,
  Users,
  Clock,
  UserCheck,
  Wallet,
  ShieldAlert,
  Cpu,
} from "lucide-react";

interface DashboardSummaryCardsProps {
  companiesCount: number;
  activeCompanies: number;
  trialCompanies: number;
  expiredCompanies: number;
  totalEmployees: number;
  onlineTodayCount: number;
  hrAdminsCount: number;
  mrr: number;
  openTickets: number;
  criticalTickets: number;
  systemUptime?: string;
  trialDays?: number;
  isLoading?: boolean;
  onOpenModal?: (modalName: string) => void;
}

export const DashboardSummaryCards: React.FC<DashboardSummaryCardsProps> = ({
  companiesCount,
  activeCompanies,
  trialCompanies,
  expiredCompanies,
  totalEmployees,
  onlineTodayCount,
  hrAdminsCount,
  mrr,
  openTickets,
  criticalTickets,
  systemUptime = "99.98%",
  trialDays,
  isLoading = false,
}) => {
  const cardCls =
    "rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-soft)] transition hover:shadow-[var(--shadow-elevated)] flex flex-col justify-between";

  const renderValue = (value: React.ReactNode) => {
    if (isLoading) {
      return <div className="h-7 w-20 bg-muted animate-pulse rounded-md mt-0.5" />;
    }
    return <span className="text-2xl font-extrabold text-foreground">{value}</span>;
  };

  return (
    <div className="space-y-4">
      {/* Row 1: 5 Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        {/* 1. TOTAL COMPANIES */}
        <div className={cardCls}>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider truncate">
              TOTAL COMPANIES
            </span>
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
              <Building2 className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            {renderValue(companiesCount)}
            <span className="inline-flex items-center text-[10px] font-bold text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded-full">
              +1
            </span>
          </div>
        </div>

        {/* 2. ACTIVE TENANCIES */}
        <div className={cardCls}>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider truncate">
              ACTIVE TENANCIES
            </span>
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-emerald-500/10 text-emerald-500">
              <CheckCircle className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            {renderValue(activeCompanies)}
            <span className="text-[10px] font-medium text-muted-foreground">Active SaaS</span>
          </div>
        </div>

        {/* 3. TRIAL ACCOUNTS */}
        <div className={cardCls}>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider truncate">
              TRIAL ACCOUNTS
            </span>
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-amber-500/10 text-amber-500">
              <Sparkles className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            {renderValue(trialCompanies)}
            <span className="text-[10px] font-medium text-amber-600 truncate">
              {trialDays ? `${trialDays}-day limit` : "Trial limit"}
            </span>
          </div>
        </div>

        {/* 4. EXPIRED ACCOUNTS */}
        <div className={cardCls}>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider truncate">
              EXPIRED ACCOUNTS
            </span>
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-rose-500/10 text-rose-500">
              <XCircle className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            {renderValue(expiredCompanies)}
            <span className="text-[10px] font-medium text-rose-500">Needs renewal</span>
          </div>
        </div>

        {/* 5. TOTAL EMPLOYEES */}
        <div className={cardCls}>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider truncate">
              TOTAL EMPLOYEES
            </span>
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-sky-500/10 text-sky-500">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            {renderValue(totalEmployees)}
            <span className="text-[10px] font-semibold text-emerald-600">in database</span>
          </div>
        </div>
      </div>

      {/* Row 2: 5 Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        {/* 6. ONLINE TODAY */}
        <div className={cardCls}>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider truncate">
              ONLINE TODAY
            </span>
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-indigo-500/10 text-indigo-500">
              <Clock className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            {renderValue(onlineTodayCount)}
            <span className="text-[10px] font-medium text-indigo-500">Active today</span>
          </div>
        </div>

        {/* 7. HR ADMINISTRATORS */}
        <div className={cardCls}>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider truncate">
              HR ADMINISTRATORS
            </span>
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-purple-500/10 text-purple-500">
              <UserCheck className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            {renderValue(hrAdminsCount)}
            <span className="text-[10px] font-medium text-muted-foreground truncate">SaaS Admins</span>
          </div>
        </div>

        {/* 8. MONTHLY REVENUE */}
        <div className={cardCls}>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider truncate">
              MONTHLY REVENUE
            </span>
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-emerald-500/10 text-emerald-500">
              <Wallet className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            {renderValue(`₹${mrr.toLocaleString()}`)}
            <span className="text-[10px] font-bold text-emerald-600">MRR</span>
          </div>
        </div>

        {/* 9. OPEN TICKETS */}
        <div className={cardCls}>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider truncate">
              OPEN TICKETS
            </span>
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-rose-500/10 text-rose-500">
              <ShieldAlert className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            {renderValue(openTickets)}
            <span className="text-[10px] font-semibold text-rose-500 truncate">
              {criticalTickets} Critical
            </span>
          </div>
        </div>

        {/* 10. SYSTEM UPTIME */}
        <div className={cardCls}>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider truncate">
              SYSTEM UPTIME
            </span>
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-teal-500/10 text-teal-500">
              <Cpu className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            {renderValue(systemUptime)}
            <span className="text-[10px] font-bold text-teal-600">Online</span>
          </div>
        </div>
      </div>
    </div>
  );
};

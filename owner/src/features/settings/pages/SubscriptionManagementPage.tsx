import React, { useState } from "react";
import {
  BarChart3,
  RefreshCw,
  TrendingUp,
  Users,
  Clock,
  XCircle,
  AlertTriangle,
  CheckCircle2,
  Ban,
  RotateCcw,
  Search,
  CreditCard,
  FileText,
  Bell,
  History,
  ToggleLeft,
  ToggleRight,
  ArrowDownCircle,
  Activity,
  DollarSign,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useSystemRuntimeSettingsQuery } from "../../../hooks/useSystemSettingsQuery";
import { formatCurrency } from "../../../utils/currency.utils";
import {
  Badge,
  PageHeader,
  cardCls,
  btnCls,
  inputCls,
} from "../../../components/ui/DashboardPrimitives";
import { Subscription, Invoice, Coupon } from "../../../services/subscription.service";
import {
  useSubscriptionStatsQuery,
  useSubscriptionsListQuery,
  useSubscriptionInvoicesQuery,
  useRenewalQueueQuery,
  useSubscriptionCouponsQuery,
  useSubscriptionMutations,
  DASHBOARD_QUERY_KEYS,
} from "../../../hooks/useDashboardQueries";

type TabId = "dashboard" | "subscriptions" | "invoices" | "payments" | "renewal-queue" | "audit";

const PLAN_COLORS: Record<string, string> = {
  PREMIUM: "text-violet-400 bg-violet-500/10 border-violet-500/20",
  STANDARD: "text-sky-400 bg-sky-500/10 border-sky-500/20",
  BASIC: "text-slate-400 bg-slate-500/10 border-slate-500/20",
};

const STATUS_COLORS: Record<string, string> = {
  Active: "green",
  Paid: "green",
  Trial: "blue",
  Pending: "amber",
  Suspended: "red",
  Cancelled: "gray",
  Expired: "orange",
  Archived: "gray",
};

function fmt(v?: number | null, currencyStr?: string) {
  const num = typeof v === "number" && !isNaN(v) ? v : 0;
  return formatCurrency(num, currencyStr, { maximumFractionDigits: 0 });
}

function remainingDays(expiry: string) {
  if (!expiry) return 0;
  const d = Math.ceil((new Date(expiry).getTime() - Date.now()) / 86400000);
  return d;
}

export function SubscriptionManagementPage({ toast }: { toast?: any }) {
  const queryClient = useQueryClient();
  const { data: systemSettings } = useSystemRuntimeSettingsQuery();

  const [activeTab, setActiveTab] = useState<TabId>("dashboard");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [planFilter, setPlanFilter] = useState("All");

  // Modal states
  const [actionModal, setActionModal] = useState<{ type: string; sub: Subscription } | null>(null);
  const [modalReason, setModalReason] = useState("");
  const [modalPlan, setModalPlan] = useState<"BASIC" | "STANDARD" | "PREMIUM">("STANDARD");
  const [modalDuration, setModalDuration] = useState<string>("1_MONTH");

  // TanStack Query Hooks (Single Source of Truth)
  const {
    data: stats,
    isLoading: statsLoading,
    isFetching: statsFetching,
  } = useSubscriptionStatsQuery();
  const { data: subscriptions = [], isLoading: subsLoading } = useSubscriptionsListQuery();
  const { data: invoices = [], isLoading: invLoading } = useSubscriptionInvoicesQuery();
  const { data: renewalQueue = [], isLoading: queueLoading } = useRenewalQueueQuery();
  const { data: coupons = [] } = useSubscriptionCouponsQuery();

  const mutations = useSubscriptionMutations();

  const loading = statsLoading || subsLoading || invLoading || queueLoading;
  const submitting =
    mutations.renewSubscription.isPending ||
    mutations.upgradeSubscription.isPending ||
    mutations.downgradeSubscription.isPending ||
    mutations.suspendSubscription.isPending ||
    mutations.reactivateSubscription.isPending ||
    mutations.cancelSubscription.isPending ||
    mutations.toggleAutoRenew.isPending ||
    mutations.deleteSubscription.isPending ||
    mutations.purgeSubscription.isPending;

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: DASHBOARD_QUERY_KEYS.subscriptionStats });
    queryClient.invalidateQueries({ queryKey: DASHBOARD_QUERY_KEYS.subscriptionsList });
    queryClient.invalidateQueries({ queryKey: DASHBOARD_QUERY_KEYS.subscriptionInvoices });
    queryClient.invalidateQueries({ queryKey: DASHBOARD_QUERY_KEYS.renewalQueue });
    queryClient.invalidateQueries({ queryKey: DASHBOARD_QUERY_KEYS.subscriptionCoupons });
  };

  const handleAction = async () => {
    if (!actionModal) return;
    const { type, sub } = actionModal;
    try {
      if (type === "renew") {
        await mutations.renewSubscription.mutateAsync({ id: sub.id, duration: modalDuration });
      } else if (type === "suspend") {
        await mutations.suspendSubscription.mutateAsync({ id: sub.id, reason: modalReason });
      } else if (type === "reactivate") {
        await mutations.reactivateSubscription.mutateAsync(sub.id);
      } else if (type === "cancel") {
        await mutations.cancelSubscription.mutateAsync({ id: sub.id, note: modalReason });
      } else if (type === "upgrade") {
        await mutations.upgradeSubscription.mutateAsync({ id: sub.id, plan: modalPlan });
      } else if (type === "downgrade") {
        await mutations.downgradeSubscription.mutateAsync({ id: sub.id, plan: modalPlan });
      } else if (type === "toggle-auto-renew") {
        await mutations.toggleAutoRenew.mutateAsync({ id: sub.id, autoRenew: !sub.autoRenew });
      } else if (type === "archive") {
        await mutations.deleteSubscription.mutateAsync(sub.id);
      } else if (type === "purge") {
        await mutations.purgeSubscription.mutateAsync(sub.id);
      }
      const actionLabel = type.charAt(0).toUpperCase() + type.slice(1);
      if (toast) toast(`${actionLabel} completed for ${sub.company}`, "success");
      setActionModal(null);
      setModalReason("");
    } catch (e: any) {
      if (toast) toast(e?.message || "Action failed", "error");
    }
  };

  const handleMarkInvoicePaid = async (id: string) => {
    try {
      await mutations.markInvoicePaid.mutateAsync(id);
      if (toast) toast("Invoice marked as paid", "success");
    } catch (e: any) {
      if (toast) toast(e?.message || "Failed", "error");
    }
  };

  const filteredSubs = (subscriptions || []).filter((s) => {
    if (!s) return false;
    const matchSearch = (s.company || "").toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "All" || s.status === statusFilter;
    const matchPlan = planFilter === "All" || s.plan === planFilter;
    return matchSearch && matchStatus && matchPlan;
  });

  const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: "dashboard", label: "Dashboard", icon: <BarChart3 size={14} /> },
    { id: "subscriptions", label: "Subscriptions", icon: <Users size={14} /> },
    { id: "invoices", label: "Invoices", icon: <FileText size={14} /> },
    { id: "payments", label: "Payments", icon: <CreditCard size={14} /> },
    { id: "renewal-queue", label: "Renewal Queue", icon: <Bell size={14} /> },
    { id: "audit", label: "Audit Log", icon: <History size={14} /> },
  ];

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading subscription data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full max-w-7xl mx-auto min-w-0 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <PageHeader
            title="Subscription Lifecycle & Billing Engine"
            subtitle="Centralised ledger for tenant subscriptions, renewals, invoices and payment processing"
          />
        </div>
        <button
          onClick={handleRefresh}
          disabled={statsFetching}
          className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2 text-sm font-semibold hover:bg-muted transition disabled:opacity-50"
        >
          <RefreshCw size={14} className={statsFetching ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 rounded-xl bg-muted/40 p-1 border border-border w-full overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold whitespace-nowrap transition-all ${
              activeTab === tab.id
                ? "bg-primary text-white shadow-md"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* ─── TAB 1: DASHBOARD ─────────────────────────────────────────── */}
      {activeTab === "dashboard" && stats && (
        <div className="space-y-6">
          {/* Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3">
            {[
              {
                label: "Total Companies",
                val: stats.totalCompanies ?? 0,
                icon: <Users size={16} />,
                color: "from-violet-500/20",
              },
              {
                label: "Active",
                val: stats.activeSubscriptions ?? 0,
                icon: <CheckCircle2 size={16} />,
                color: "from-emerald-500/20",
              },
              {
                label: "Trial",
                val: stats.trialCompanies ?? 0,
                icon: <Clock size={16} />,
                color: "from-sky-500/20",
              },
              {
                label: "Expiring (30d)",
                val: stats.expiringIn30Days ?? 0,
                icon: <AlertTriangle size={16} />,
                color: "from-amber-500/20",
              },
              {
                label: "Expired",
                val: stats.expired ?? 0,
                icon: <XCircle size={16} />,
                color: "from-orange-500/20",
              },
              {
                label: "Suspended",
                val: stats.suspended ?? 0,
                icon: <Ban size={16} />,
                color: "from-red-500/20",
              },
              {
                label: "Cancelled",
                val: stats.cancelled ?? 0,
                icon: <XCircle size={16} />,
                color: "from-slate-500/20",
              },
            ].map((s) => (
              <div
                key={s.label}
                className={`${cardCls} bg-gradient-to-br ${s.color} to-transparent`}
              >
                <div className="flex items-center gap-2 text-muted-foreground mb-2">
                  {s.icon}
                  <span className="text-xs font-semibold">{s.label}</span>
                </div>
                <div className="text-2xl font-bold">{s.val}</div>
              </div>
            ))}
          </div>

          {/* Revenue Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              {
                label: "Total Revenue",
                val: fmt(stats.totalRevenue),
                sub: "All time",
                color: "from-violet-500/10",
              },
              {
                label: "Monthly Revenue",
                val: fmt(stats.monthlyRevenue),
                sub: "This month",
                color: "from-emerald-500/10",
              },
              {
                label: "MRR",
                val: fmt(stats.mrr),
                sub: "Recurring / mo",
                color: "from-sky-500/10",
              },
              {
                label: "ARR",
                val: fmt(stats.arr),
                sub: "Annual run rate",
                color: "from-amber-500/10",
              },
            ].map((c) => (
              <div
                key={c.label}
                className={`${cardCls} bg-gradient-to-br ${c.color} to-transparent`}
              >
                <div className="text-xs font-semibold text-muted-foreground mb-1">{c.label}</div>
                <div className="text-2xl font-bold">{c.val}</div>
                <div className="text-xs text-muted-foreground mt-1">{c.sub}</div>
              </div>
            ))}
          </div>

          {/* Metrics Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              {
                label: "Renewal Rate",
                val: `${stats.renewalRate ?? 100}%`,
                icon: <TrendingUp size={16} className="text-emerald-400" />,
              },
              {
                label: "Churn Rate",
                val: `${stats.churnRate ?? 0}%`,
                icon: <ArrowDownCircle size={16} className="text-red-400" />,
              },
              {
                label: "Renewals Today",
                val: stats.renewalsToday ?? 0,
                icon: <RotateCcw size={16} className="text-sky-400" />,
              },
              {
                label: "Annual Revenue",
                val: fmt(stats.annualRevenue),
                icon: <DollarSign size={16} className="text-amber-400" />,
              },
            ].map((m) => (
              <div key={m.label} className={cardCls}>
                <div className="flex items-center gap-2 mb-2 text-muted-foreground">
                  {m.icon}
                  <span className="text-xs font-semibold">{m.label}</span>
                </div>
                <div className="text-2xl font-bold">{m.val}</div>
              </div>
            ))}
          </div>

          {/* Recent Activity */}
          <div className="grid md:grid-cols-2 gap-4">
            <div className={`${cardCls} min-w-0 overflow-hidden`}>
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <CreditCard size={14} className="shrink-0" />
                <span>Recent Payments</span>
              </h3>
              {!stats.recentPayments || stats.recentPayments.length === 0 ? (
                <p className="text-sm text-muted-foreground">No payments yet</p>
              ) : (
                <div className="space-y-2.5">
                  {stats.recentPayments.map((inv) => (
                    <div key={inv.id} className="flex items-center justify-between text-sm gap-2 min-w-0">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">{inv.company}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {inv.date} · {inv.id}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-bold text-emerald-400">{fmt(inv.amount)}</p>
                        <Badge tone="green">{inv.status}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className={`${cardCls} min-w-0 overflow-hidden`}>
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Activity size={14} className="shrink-0" />
                <span>Latest Activity</span>
              </h3>
              {!stats.recentEvents || stats.recentEvents.length === 0 ? (
                <p className="text-sm text-muted-foreground">No events yet</p>
              ) : (
                <div className="space-y-2.5">
                  {stats.recentEvents.slice(0, 5).map((ev: any) => (
                    <div key={ev.id || ev.timestamp} className="flex items-start gap-2.5 text-sm min-w-0">
                      <span className="mt-1.5 h-2 w-2 rounded-full bg-primary shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-foreground truncate">{ev.type || ev.event}</p>
                        <p className="text-xs text-muted-foreground break-words line-clamp-2">
                          <span className="font-semibold text-foreground/80">{ev.company || ev.subscriptionId?.slice(0, 8) || "Platform"}</span>
                          {(ev.details || ev.note) ? ` · ${ev.details || ev.note}` : ""}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB 2: SUBSCRIPTIONS ─────────────────────────────────────── */}
      {activeTab === "subscriptions" && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <input
                id="subSearch"
                name="subSearch"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search company..."
                className={`${inputCls} pl-9`}
              />
            </div>
            <select
              id="subStatusFilter"
              name="subStatusFilter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className={inputCls}
            >
              {[
                "All",
                "Active",
                "Paid",
                "Trial",
                "Suspended",
                "Cancelled",
                "Expired",
                "Archived",
              ].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
            <select
              id="subPlanFilter"
              name="subPlanFilter"
              value={planFilter}
              onChange={(e) => setPlanFilter(e.target.value)}
              className={inputCls}
            >
              {["All", "BASIC", "STANDARD", "PREMIUM"].map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
            <span className="text-xs text-muted-foreground self-center">
              {(filteredSubs || []).length} of {(subscriptions || []).length}
            </span>
          </div>

          <div className={`${cardCls} p-0 overflow-hidden`}>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted/50 text-muted-foreground border-b border-border">
                  <tr>
                    {[
                      "Company",
                      "Plan",
                      "Status",
                      "Cycle",
                      "Start",
                      "Expiry",
                      "Days Left",
                      "Auto Renew",
                      "Amount",
                      "Actions",
                    ].map((h) => (
                      <th key={h} className="p-3 font-semibold text-xs whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {!filteredSubs || filteredSubs.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="p-8 text-center text-muted-foreground">
                        No subscriptions found
                      </td>
                    </tr>
                  ) : (
                    filteredSubs.map((s) => {
                      const days = remainingDays(s.expiry);
                      return (
                        <tr key={s.id} className="hover:bg-muted/30 transition">
                          <td className="p-3 font-semibold">
                            <div className="flex items-center gap-2">
                              <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                                {(s.logo || s.company.slice(0, 2)).toUpperCase()}
                              </div>
                              {s.company}
                            </div>
                          </td>
                          <td className="p-3">
                            <span
                              className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${PLAN_COLORS[s.plan] || ""}`}
                            >
                              {s.plan}
                            </span>
                          </td>
                          <td className="p-3">
                            <Badge tone={(STATUS_COLORS[s.status] as any) || "gray"}>
                              {s.status}
                            </Badge>
                          </td>
                          <td className="p-3 text-xs">{s.cycle}</td>
                          <td className="p-3 text-xs font-mono">{s.start}</td>
                          <td className="p-3 text-xs font-mono">{s.expiry}</td>
                          <td className="p-3">
                            <span
                              className={`text-xs font-semibold ${
                                days <= 7
                                  ? "text-red-400"
                                  : days <= 30
                                    ? "text-amber-400"
                                    : "text-emerald-400"
                              }`}
                            >
                              {days < 0 ? "Expired" : `${days}d`}
                            </span>
                          </td>
                          <td className="p-3">
                            <button
                              onClick={() => setActionModal({ type: "toggle-auto-renew", sub: s })}
                              className="flex items-center gap-1 text-xs"
                            >
                              {s.autoRenew !== false ? (
                                <ToggleRight size={16} className="text-emerald-400" />
                              ) : (
                                <ToggleLeft size={16} className="text-muted-foreground" />
                              )}
                              <span className="text-muted-foreground">
                                {s.autoRenew !== false ? "On" : "Off"}
                              </span>
                            </button>
                          </td>
                          <td className="p-3 font-medium text-xs">{fmt(s.amount)}</td>
                          <td className="p-3">
                            <div className="flex gap-1 flex-wrap">
                              {s.status !== "Cancelled" && s.status !== "Suspended" && (
                                <button
                                  onClick={() => setActionModal({ type: "renew", sub: s })}
                                  className="rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 text-xs font-semibold hover:bg-emerald-500/20 transition"
                                >
                                  Renew
                                </button>
                              )}
                              {s.status !== "Cancelled" && s.plan !== "PREMIUM" && (
                                <button
                                  onClick={() => {
                                    setModalPlan("PREMIUM");
                                    setActionModal({ type: "upgrade", sub: s });
                                  }}
                                  className="rounded-md bg-violet-500/10 text-violet-400 border border-violet-500/20 px-2 py-0.5 text-xs font-semibold hover:bg-violet-500/20 transition"
                                >
                                  ↑ Up
                                </button>
                              )}
                              {s.status !== "Cancelled" && s.plan !== "BASIC" && (
                                <button
                                  onClick={() => {
                                    setModalPlan("BASIC");
                                    setActionModal({ type: "downgrade", sub: s });
                                  }}
                                  className="rounded-md bg-slate-500/10 text-slate-400 border border-slate-500/20 px-2 py-0.5 text-xs font-semibold hover:bg-slate-500/20 transition"
                                >
                                  ↓ Down
                                </button>
                              )}
                              {s.status === "Suspended" ? (
                                <button
                                  onClick={() => setActionModal({ type: "reactivate", sub: s })}
                                  className="rounded-md bg-sky-500/10 text-sky-400 border border-sky-500/20 px-2 py-0.5 text-xs font-semibold hover:bg-sky-500/20 transition"
                                >
                                  Reactivate
                                </button>
                              ) : (
                                <button
                                  onClick={() => setActionModal({ type: "suspend", sub: s })}
                                  className="rounded-md bg-red-500/10 text-red-400 border border-red-500/20 px-2 py-0.5 text-xs font-semibold hover:bg-red-500/20 transition"
                                >
                                  Suspend
                                </button>
                              )}
                              {s.status !== "Cancelled" && (
                                <button
                                  onClick={() => setActionModal({ type: "cancel", sub: s })}
                                  className="rounded-md bg-slate-500/10 text-slate-400 border border-slate-500/20 px-2 py-0.5 text-xs font-semibold hover:bg-slate-500/20 transition"
                                >
                                  Cancel
                                </button>
                              )}
                              <button
                                onClick={() => setActionModal({ type: "archive", sub: s })}
                                className="rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 text-xs font-semibold hover:bg-amber-500/20 transition"
                              >
                                Archive
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB 3: INVOICES ─────────────────────────────────────────── */}
      {activeTab === "invoices" && (
        <div className={`${cardCls} p-0 overflow-hidden`}>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/50 text-muted-foreground border-b border-border">
                <tr>
                  {["Invoice ID", "Company", "Date", "Amount", "Status", "Actions"].map((h) => (
                    <th key={h} className="p-3 font-semibold text-xs whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {!invoices || invoices.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-muted-foreground">
                      No invoices found
                    </td>
                  </tr>
                ) : (
                  invoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-muted/30 transition">
                      <td className="p-3 font-mono text-xs">{inv.id}</td>
                      <td className="p-3 font-medium">{inv.company}</td>
                      <td className="p-3 text-xs font-mono">{inv.date}</td>
                      <td className="p-3 font-bold text-emerald-400">{fmt(inv.amount)}</td>
                      <td className="p-3">
                        <Badge
                          tone={
                            inv.status === "Paid"
                              ? "green"
                              : inv.status === "Pending"
                                ? "amber"
                                : "gray"
                          }
                        >
                          {inv.status}
                        </Badge>
                      </td>
                      <td className="p-3">
                        {inv.status === "Pending" && (
                          <button
                            onClick={() => handleMarkInvoicePaid(inv.id)}
                            className="rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-1 text-xs font-semibold hover:bg-emerald-500/20 transition"
                          >
                            Mark Paid
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── TAB 4: PAYMENTS ─────────────────────────────────────────── */}
      {activeTab === "payments" && (
        <div className={`${cardCls} p-0 overflow-hidden`}>
          <div className="p-4 border-b border-border font-semibold text-sm">
            Completed Payment Transactions
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/50 text-muted-foreground border-b border-border">
                <tr>
                  {["Transaction ID", "Company", "Date", "Amount", "Method", "Status"].map((h) => (
                    <th key={h} className="p-3 font-semibold text-xs whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {invoices.filter((i) => i.status === "Paid" || i.status === "Processed").length ===
                0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-muted-foreground">
                      No payment records found
                    </td>
                  </tr>
                ) : (
                  invoices
                    .filter((i) => i.status === "Paid" || i.status === "Processed")
                    .map((inv) => (
                      <tr key={inv.id} className="hover:bg-muted/30 transition">
                        <td className="p-3 font-mono text-xs">{inv.id}</td>
                        <td className="p-3 font-medium">{inv.company}</td>
                        <td className="p-3 text-xs font-mono">{inv.date}</td>
                        <td className="p-3 font-bold text-emerald-400">{fmt(inv.amount)}</td>
                        <td className="p-3 text-xs">Bank Transfer / UPI</td>
                        <td className="p-3">
                          <Badge tone="green">Success</Badge>
                        </td>
                      </tr>
                    ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── TAB 5: RENEWAL QUEUE ─────────────────────────────────────── */}
      {activeTab === "renewal-queue" && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertTriangle className="text-amber-400" size={20} />
              <div>
                <p className="font-semibold text-sm">Subscriptions Expiring in 30 Days</p>
                <p className="text-xs text-muted-foreground">
                  {renewalQueue.length} subscriptions require action
                </p>
              </div>
            </div>
          </div>

          <div className={`${cardCls} p-0 overflow-hidden`}>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted/50 text-muted-foreground border-b border-border">
                  <tr>
                    {[
                      "Company",
                      "Plan",
                      "Expiry Date",
                      "Days Remaining",
                      "Auto Renew",
                      "Actions",
                    ].map((h) => (
                      <th key={h} className="p-3 font-semibold text-xs whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {renewalQueue.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-muted-foreground">
                        No subscriptions expiring soon
                      </td>
                    </tr>
                  ) : (
                    renewalQueue.map((s) => (
                      <tr key={s.id} className="hover:bg-muted/30 transition">
                        <td className="p-3 font-semibold">{s.company}</td>
                        <td className="p-3">
                          <span
                            className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${PLAN_COLORS[s.plan] || ""}`}
                          >
                            {s.plan}
                          </span>
                        </td>
                        <td className="p-3 text-xs font-mono">{s.expiry}</td>
                        <td className="p-3 font-bold text-amber-400">{s.daysLeft} days</td>
                        <td className="p-3 text-xs">
                          {s.autoRenew !== false ? "Enabled" : "Disabled"}
                        </td>
                        <td className="p-3">
                          <button
                            onClick={() => setActionModal({ type: "renew", sub: s })}
                            className="rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-1 text-xs font-semibold hover:bg-emerald-500/20 transition"
                          >
                            Renew Now
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB 6: AUDIT LOG ─────────────────────────────────────────── */}
      {activeTab === "audit" && (
        <div className={`${cardCls} p-0 overflow-hidden`}>
          <div className="p-4 border-b border-border font-semibold text-sm">
            Subscription Audit Trail
          </div>
          <div className="divide-y divide-border">
            {!stats?.recentEvents || stats.recentEvents.length === 0 ? (
              <p className="p-8 text-center text-muted-foreground text-sm">
                No audit logs recorded
              </p>
            ) : (
              stats.recentEvents.map((ev: any) => (
                <div
                  key={ev.id || ev.timestamp}
                  className="p-4 flex items-start gap-3 hover:bg-muted/30 transition"
                >
                  <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0 mt-0.5">
                    <Activity size={16} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-sm">{ev.type || ev.event}</p>
                      <span className="text-xs text-muted-foreground font-mono">
                        {new Date(ev.timestamp || Date.now()).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Company:{" "}
                      <span className="font-medium text-foreground">
                        {ev.company || ev.subscriptionId || "Platform"}
                      </span>
                    </p>
                    {(ev.details || ev.note) && (
                      <p className="text-xs bg-muted/40 rounded-lg p-2 mt-2 font-mono">
                        {ev.details || ev.note}
                      </p>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ─── ACTION CONFIRMATION MODAL ─────────────────────────────────── */}
      {actionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-card border border-border rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-bold">
              Confirm {actionModal.type.charAt(0).toUpperCase() + actionModal.type.slice(1)}
            </h3>
            <p className="text-sm text-muted-foreground">
              Are you sure you want to perform action <strong>{actionModal.type}</strong> on
              subscription for <strong>{actionModal.sub.company}</strong>?
            </p>

            {actionModal.type === "renew" && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Renewal Duration</label>
                <select
                  value={modalDuration}
                  onChange={(e) => setModalDuration(e.target.value)}
                  className={inputCls}
                >
                  <option value="14_DAYS">14 Days (Trial / Courtesy Extension)</option>
                  <option value="1_MONTH">1 Month (Monthly Billing Cycle)</option>
                  <option value="1_YEAR">1 Year (Annual Billing Cycle)</option>
                </select>
              </div>
            )}

            {(actionModal.type === "upgrade" || actionModal.type === "downgrade") && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Target Plan</label>
                <select
                  value={modalPlan}
                  onChange={(e) => setModalPlan(e.target.value as any)}
                  className={inputCls}
                >
                  <option value="BASIC">BASIC</option>
                  <option value="STANDARD">STANDARD</option>
                  <option value="PREMIUM">PREMIUM</option>
                </select>
              </div>
            )}

            {(actionModal.type === "suspend" || actionModal.type === "cancel") && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">
                  Reason / Notes
                </label>
                <textarea
                  value={modalReason}
                  onChange={(e) => setModalReason(e.target.value)}
                  placeholder="Enter reason for this action..."
                  className={`${inputCls} h-20 py-2 resize-none`}
                />
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setActionModal(null)}
                disabled={submitting}
                className="px-4 py-2 rounded-xl border border-border text-sm font-semibold hover:bg-muted transition"
              >
                Cancel
              </button>
              <button
                onClick={handleAction}
                disabled={submitting}
                className={`px-4 py-2 rounded-xl text-sm font-semibold text-white transition ${
                  actionModal.type === "suspend" ||
                  actionModal.type === "cancel" ||
                  actionModal.type === "purge"
                    ? "bg-destructive hover:brightness-110"
                    : "btn-gradient hover:brightness-110"
                }`}
              >
                {submitting ? "Processing..." : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import React from "react";
import type { SaaSCompany, SaaSInvoice } from "../../types/superAdmin.types";
import type { EnrichedStats } from "../../../../services/subscription.service";

const cardCls =
  "rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)] transition hover:shadow-[var(--shadow-elevated)]";

function LocalBadge({
  children,
  tone = "slate",
  className = "",
}: {
  children: React.ReactNode;
  tone?: string;
  className?: string;
}) {
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
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${tones[tone] || tones.slate} ${className}`}
    >
      {children}
    </span>
  );
}

interface RevenueGrowthChartsProps {
  mrr: number;
  arr: number;
  invoices: SaaSInvoice[];
  renewalsDueAmount: number;
  revenueTrendPoints: Array<{ month: string; amount: number }>;
  momGrowthStr: string;
  activeCompanies: number;
  companyGrowthBars: Array<{ month: string; count: number }>;
  companies: SaaSCompany[];
  seatMetrics: {
    totalPurchased: number;
    used: number;
    available: number;
  };
  empGrowthTrend: { pathD: string; areaD: string };
  isLoading?: boolean;
  subscriptionStats?: EnrichedStats | null;
}

export const RevenueGrowthCharts: React.FC<RevenueGrowthChartsProps> = ({
  mrr,
  arr,
  invoices,
  renewalsDueAmount,
  revenueTrendPoints,
  momGrowthStr,
  activeCompanies,
  companyGrowthBars,
  companies,
  seatMetrics,
  empGrowthTrend,
  isLoading = false,
  subscriptionStats,
}) => {
  // Plan normalization & counts from CURRENT subscriptions only (excluding cancelled/expired historical records)
  const normalizePlan = (p?: string) => (p || "").toUpperCase().trim();
  const currentSubscriptions = companies.filter((c) => {
    const status = normalizePlan(c.status);
    return ["ACTIVE", "PAID", "TRIAL"].includes(status);
  });
  const premiumCount = currentSubscriptions.filter((c) => normalizePlan(c.plan) === "PREMIUM").length;
  const standardCount = currentSubscriptions.filter((c) => normalizePlan(c.plan) === "STANDARD").length;
  const basicCount = currentSubscriptions.filter((c) => normalizePlan(c.plan) === "BASIC").length;

  // Authoritative Subscription Statuses from backend stats or company records
  const totalSubs = subscriptionStats?.totalCompanies ?? companies.length ?? 0;
  const activeSubs =
    subscriptionStats?.activeSubscriptions ??
    companies.filter((c) => ["ACTIVE", "PAID"].includes(normalizePlan(c.status))).length;
  const trialSubs =
    subscriptionStats?.trialCompanies ??
    companies.filter((c) => normalizePlan(c.status) === "TRIAL").length;
  const expiredSubs =
    subscriptionStats?.expired ??
    companies.filter((c) => normalizePlan(c.status) === "EXPIRED").length;
  const suspendedSubs =
    subscriptionStats?.suspended ??
    companies.filter((c) => normalizePlan(c.status) === "SUSPENDED").length;
  const cancelledSubs =
    subscriptionStats?.cancelled ??
    companies.filter((c) => normalizePlan(c.status) === "CANCELLED").length;

  const inactiveOtherSubs =
    (subscriptionStats?.other ?? 0) + suspendedSubs + cancelledSubs;

  // Largest remainder allocation ensuring status percentages sum to exactly 100% without rounding drift
  const allocatePercentages = (counts: number[], total: number): number[] => {
    if (total <= 0) return counts.map(() => 0);
    const raw = counts.map((c) => (c / total) * 100);
    const floors = raw.map(Math.floor);
    const remainder = 100 - floors.reduce((a, b) => a + b, 0);

    const fractions = raw.map((r, idx) => ({ idx, frac: r - Math.floor(r) }));
    fractions.sort((a, b) => b.frac - a.frac);

    const result = [...floors];
    for (let i = 0; i < remainder && i < fractions.length; i++) {
      result[fractions[i].idx] += 1;
    }
    return result;
  };

  const [activePct, trialPct, expiredPct, otherPct] = allocatePercentages(
    [activeSubs, trialSubs, expiredSubs, inactiveOtherSubs],
    totalSubs,
  );

  // Real Historical Renewal Rate from backend
  const renewalRate =
    subscriptionStats?.renewalRate ??
    (totalSubs > 0 ? Math.round((activeSubs / totalSubs) * 100) : 100);

  // Dynamic Renewal Status Badge with strict severity precedence (Expired > Expiring > Inactive > Healthy)
  const expiringIn30 = subscriptionStats?.expiringIn30Days ?? 0;
  const renewalBadge = (() => {
    if (expiredSubs > 0) {
      return { label: `${expiredSubs} Expired`, tone: "rose" };
    }
    if (expiringIn30 > 0) {
      return { label: `${expiringIn30} Renewals Due (30d)`, tone: "amber" };
    }
    if (cancelledSubs > 0 || suspendedSubs > 0) {
      return {
        label: `${cancelledSubs + suspendedSubs} Inactive/Cancelled`,
        tone: "amber",
      };
    }
    if (totalSubs === 0) {
      return { label: "No Subscriptions", tone: "slate" };
    }
    return { label: "Renewals Healthy", tone: "green" };
  })();

  return (
    <div className="space-y-6">
      {/* Row 1: Revenue dashboard & Company growth charts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className={cardCls}>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-foreground">Revenue Dashboard</h3>
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                {isLoading ? (
                  <span className="inline-block h-3.5 w-36 bg-muted animate-pulse rounded align-middle" />
                ) : (
                  `MRR: ₹${mrr.toLocaleString()} | ARR: ₹${arr.toLocaleString()}`
                )}
              </p>
            </div>
            <LocalBadge tone="green">ARR Forecast</LocalBadge>
          </div>
          <div className="grid grid-cols-3 gap-2 mb-4 bg-muted/40 p-3 rounded-lg text-center">
            <div>
              <div className="text-xs text-muted-foreground">Outstanding Invoices</div>
              <div className="text-sm font-bold text-rose-500">
                ₹
                {invoices
                  .filter((i) => i.status === "Outstanding")
                  .reduce((s, i) => s + i.amount, 0)
                  .toLocaleString()}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Renewals Due</div>
              <div className="text-sm font-bold text-amber-500">
                ₹{renewalsDueAmount.toLocaleString()}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Paid Invoices</div>
              <div className="text-sm font-bold text-[color:var(--color-success)]">
                ₹
                {invoices
                  .filter((i) => i.status === "Paid")
                  .reduce((s, i) => s + i.amount, 0)
                  .toLocaleString()}
              </div>
            </div>
          </div>
          {/* Revenue Trend SVG Area Chart */}
          <div className="h-40 w-full bg-muted/20 rounded-xl p-3 flex flex-col justify-between">
            <div className="h-32 w-full relative">
              {(() => {
                if (!revenueTrendPoints || revenueTrendPoints.length < 2) {
                  return (
                    <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                      Insufficient trend data
                    </div>
                  );
                }
                const maxVal = Math.max(...revenueTrendPoints.map((p) => p.amount), 1);
                const points = revenueTrendPoints.map((p, i) => {
                  const x = (i / (revenueTrendPoints.length - 1)) * 400;
                  const y = 80 - (p.amount / maxVal) * 60;
                  return { x, y };
                });
                const pathD = points.reduce(
                  (acc, p, i) => `${acc} ${i === 0 ? "M" : "L"} ${p.x} ${p.y}`,
                  "",
                );
                const areaD = `${pathD} L 400 90 L 0 90 Z`;
                return (
                  <svg className="w-full h-full" viewBox="0 0 400 90" preserveAspectRatio="none">
                    <defs>
                      <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.4" />
                        <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    <path d={areaD} fill="url(#revGrad)" />
                    <path
                      d={pathD}
                      fill="none"
                      stroke="var(--color-primary)"
                      strokeWidth="2.5"
                    />
                    {points.map((pt, i) => (
                      <circle
                        key={i}
                        cx={pt.x}
                        cy={pt.y}
                        r={i === points.length - 1 ? "4.5" : "3.5"}
                        fill={
                          i === points.length - 1 ? "var(--color-success)" : "var(--color-primary)"
                        }
                      />
                    ))}
                  </svg>
                );
              })()}
            </div>
          </div>
        </div>

        <div className={cardCls}>
          <h3 className="mb-4 text-sm font-bold text-foreground">Company Growth Analytics</h3>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="bg-muted/40 p-3 rounded-lg">
              <div className="text-xs text-muted-foreground">Companies Joined (MoM)</div>
              <div className="text-xl font-bold">{momGrowthStr}</div>
            </div>
            <div className="bg-muted/40 p-3 rounded-lg">
              <div className="text-xs text-muted-foreground">Active Company Trend</div>
              <div className="text-xl font-bold">{activeCompanies} Active</div>
            </div>
          </div>
          {/* Company Growth Bar Chart (SVG) */}
          <div className="h-40 w-full bg-muted/20 rounded-xl p-3 flex flex-col justify-between">
            <div className="flex-1 flex items-end justify-between gap-3 h-full">
              {companyGrowthBars.map((item, i) => {
                const maxCount = Math.max(...companyGrowthBars.map((b) => b.count), 0);
                const heightPct =
                  maxCount > 0 && item.count > 0
                    ? Math.max(Math.round((item.count / maxCount) * 85), 10)
                    : 0;
                return (
                  <div
                    key={i}
                    className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end group"
                  >
                    <div className="text-[9px] text-muted-foreground opacity-0 group-hover:opacity-100 transition font-medium">
                      {item.count}
                    </div>
                    {heightPct > 0 ? (
                      <div
                        className="w-full bg-indigo-500/80 hover:bg-indigo-500 rounded-t transition-all duration-300"
                        style={{ height: `${heightPct}%` }}
                      />
                    ) : (
                      <div className="w-full h-1 bg-muted-foreground/20 rounded-sm" />
                    )}
                    <span className="text-[9px] text-muted-foreground">{item.month}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Row 2: Subscription overview & Employee growth analytics */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className={cardCls}>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-bold text-foreground">Subscription Overview</h3>
            <LocalBadge tone={renewalBadge.tone}>{renewalBadge.label}</LocalBadge>
          </div>
          <div className="grid grid-cols-3 gap-2 mb-4 text-center">
            <div className="border border-border p-2.5 rounded-xl">
              <span className="text-xs text-muted-foreground uppercase font-semibold">Premium</span>
              <div className="text-lg font-bold text-primary">
                {premiumCount}
              </div>
            </div>
            <div className="border border-border p-2.5 rounded-xl">
              <span className="text-xs text-muted-foreground uppercase font-semibold">
                Standard
              </span>
              <div className="text-lg font-bold text-indigo-500">
                {standardCount}
              </div>
            </div>
            <div className="border border-border p-2.5 rounded-xl">
              <span className="text-xs text-muted-foreground uppercase font-semibold">Basic</span>
              <div className="text-lg font-bold text-sky-500">
                {basicCount}
              </div>
            </div>
          </div>
          <div className="min-h-[8rem] bg-muted/20 rounded-xl p-3 flex flex-col justify-center">
            <div className="text-xs font-semibold text-foreground mb-1.5 flex justify-between">
              <span>Historical Renewal Rate</span>
              <span>{renewalRate}%</span>
            </div>
            <div className="w-full bg-muted-foreground/20 h-2.5 rounded-full overflow-hidden flex">
              {activePct > 0 && (
                <div
                  className="bg-[color:var(--color-success)] h-full transition-all"
                  style={{ width: `${activePct}%` }}
                  title={`Active: ${activeSubs} (${activePct}%)`}
                />
              )}
              {trialPct > 0 && (
                <div
                  className="bg-[color:var(--color-warning)] h-full transition-all"
                  style={{ width: `${trialPct}%` }}
                  title={`Trial: ${trialSubs} (${trialPct}%)`}
                />
              )}
              {expiredPct > 0 && (
                <div
                  className="bg-destructive h-full transition-all"
                  style={{ width: `${expiredPct}%` }}
                  title={`Expired: ${expiredSubs} (${expiredPct}%)`}
                />
              )}
              {otherPct > 0 && (
                <div
                  className="bg-muted-foreground/60 h-full transition-all"
                  style={{ width: `${otherPct}%` }}
                  title={`Suspended/Cancelled: ${inactiveOtherSubs} (${otherPct}%)`}
                />
              )}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-[color:var(--color-success)]" /> Active ({activeSubs})
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-[color:var(--color-warning)]" /> Trial ({trialSubs})
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-destructive" /> Expired ({expiredSubs})
              </span>
              {inactiveOtherSubs > 0 && (
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-muted-foreground/60" /> Suspended/Cancelled ({inactiveOtherSubs})
                </span>
              )}
            </div>
          </div>
        </div>

        <div className={cardCls}>
          <h3 className="mb-4 text-sm font-bold text-foreground">Employee Growth Analytics</h3>
          <div className="grid grid-cols-3 gap-2 mb-4 text-center">
            <div className="bg-muted/40 p-2.5 rounded-xl">
              <div className="text-[10px] text-muted-foreground">Purchased Seats</div>
              <div className="text-lg font-bold">{seatMetrics.totalPurchased}</div>
            </div>
            <div className="bg-muted/40 p-2.5 rounded-xl">
              <div className="text-[10px] text-muted-foreground">Active Assigned</div>
              <div className="text-lg font-bold text-primary">{seatMetrics.used}</div>
            </div>
            <div className="bg-muted/40 p-2.5 rounded-xl">
              <div className="text-[10px] text-muted-foreground">Available Slots</div>
              <div className="text-lg font-bold text-emerald-500">{seatMetrics.available}</div>
            </div>
          </div>
          <div className="h-32 w-full bg-muted/20 rounded-xl p-3 flex items-center justify-center relative overflow-hidden">
            <svg className="w-full h-full" viewBox="0 0 500 100" preserveAspectRatio="none">
              <defs>
                <linearGradient id="empGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-info)" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="var(--color-info)" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path
                d={empGrowthTrend.pathD}
                fill="none"
                stroke="var(--color-info)"
                strokeWidth="2.5"
              />
              <path d={empGrowthTrend.areaD} fill="url(#empGrad)" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
};

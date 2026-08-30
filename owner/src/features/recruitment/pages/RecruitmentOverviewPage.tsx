import React, { useState, useEffect, useMemo } from "react";
import {
  Briefcase,
  Users,
  Calendar,
  Award,
  TrendingUp,
  Building2,
  Layers,
  RefreshCw,
  Activity,
  Loader2,
  AlertCircle,
  BarChart3,
} from "lucide-react";
import {
  recruitmentService,
  PlatformRecruitmentOverview,
} from "../../../services/recruitment.service";

const cardCls =
  "rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)] transition hover:shadow-[var(--shadow-elevated)]";
const inputCls =
  "h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20";
const btnCls =
  "inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition hover:brightness-110 px-3 py-1.5 text-xs bg-primary text-white";

function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 className="text-xl font-bold tracking-tight md:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {action && <div className="flex gap-2">{action}</div>}
    </div>
  );
}

function Badge({
  children,
  tone = "slate",
}: {
  children: React.ReactNode;
  tone?: "slate" | "green" | "amber" | "rose" | "indigo" | "sky";
}) {
  const tones = {
    slate: "bg-muted text-muted-foreground",
    green: "bg-[color:var(--color-success)]/15 text-[color:var(--color-success)]",
    amber: "bg-[color:var(--color-warning)]/15 text-[color:var(--color-warning)]",
    rose: "bg-destructive/15 text-destructive",
    indigo: "bg-primary/15 text-primary",
    sky: "bg-[color:var(--color-info)]/15 text-[color:var(--color-info)]",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export function RecruitmentOverviewPage() {
  const [data, setData] = useState<PlatformRecruitmentOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOverview = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await recruitmentService.getPlatformOverview();
      setData(result);
    } catch (err: any) {
      setError(err?.message || "Failed to load platform recruitment metrics");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchOverview();
  }, []);

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm font-medium text-muted-foreground">
            Aggregating platform recruitment analytics...
          </p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-6 w-full max-w-7xl mx-auto min-w-0">
        <PageHeader
          title="Recruitment Overview"
          subtitle="Platform-wide hiring metrics and pipeline status"
        />
        <div className={cardCls + " p-6 text-center"}>
          <AlertCircle className="w-10 h-10 mx-auto text-destructive mb-2" />
          <p className="text-sm font-medium text-destructive mb-4">
            {error || "Failed to load analytics"}
          </p>
          <button onClick={fetchOverview} className={btnCls}>
            <RefreshCw className="w-4 h-4" /> Retry Loading
          </button>
        </div>
      </div>
    );
  }

  const maxTrendVal = Math.max(
    ...data.hiringTrends.flatMap((t) => [t.jobsPosted, t.candidatesApplied]),
    1,
  );

  const totalStageCandidates = data.pipelineStageDistribution.reduce((sum, s) => sum + s.count, 0);

  return (
    <div className="space-y-6 w-full max-w-7xl mx-auto min-w-0 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <PageHeader
        title="Recruitment Overview"
        subtitle="Platform-wide real-time hiring metrics and pipeline analytics"
        action={
          <button
            onClick={fetchOverview}
            className={btnCls + " !bg-secondary !text-secondary-foreground"}
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh Metrics
          </button>
        }
      />

      {/* Top Level Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3 sm:gap-4">
        <div className={cardCls}>
          <div className="text-muted-foreground text-[11px] font-semibold mb-1">
            Total Open Jobs
          </div>
          <div className="text-2xl font-bold">{data.totalOpenJobs.toLocaleString()}</div>
          <div className="text-[10px] text-emerald-600 font-medium mt-1">
            +{data.jobsPostedThisMonth} this month
          </div>
        </div>
        <div className={cardCls}>
          <div className="text-muted-foreground text-[11px] font-semibold mb-1">
            Total Candidates
          </div>
          <div className="text-2xl font-bold">{data.totalCandidates.toLocaleString()}</div>
          <div className="text-[10px] text-primary font-medium mt-1">Platform Total</div>
        </div>
        <div className={cardCls}>
          <div className="text-muted-foreground text-[11px] font-semibold mb-1">
            Interviews Scheduled
          </div>
          <div className="text-2xl font-bold text-amber-500">
            {data.interviewsScheduled.toLocaleString()}
          </div>
          <div className="text-[10px] text-muted-foreground mt-1">Active Pipeline</div>
        </div>
        <div className={cardCls}>
          <div className="text-muted-foreground text-[11px] font-semibold mb-1">Offers Sent</div>
          <div className="text-2xl font-bold text-indigo-500">
            {data.offersSent.toLocaleString()}
          </div>
          <div className="text-[10px] text-muted-foreground mt-1">Pending Decision</div>
        </div>
        <div className={cardCls}>
          <div className="text-muted-foreground text-[11px] font-semibold mb-1">Total Hired</div>
          <div className="text-2xl font-bold text-emerald-600">
            {data.hiredCount.toLocaleString()}
          </div>
          <div className="text-[10px] text-emerald-600 font-medium mt-1">
            +{data.candidatesHiredThisMonth} this month
          </div>
        </div>
        <div className={cardCls}>
          <div className="text-muted-foreground text-[11px] font-semibold mb-1">
            Acceptance Rate
          </div>
          <div className="text-2xl font-bold text-emerald-600">{data.offerAcceptanceRate}%</div>
          <div className="text-[10px] text-muted-foreground mt-1">Offer to Hired</div>
        </div>
        <div className={cardCls}>
          <div className="text-muted-foreground text-[11px] font-semibold mb-1">
            Hiring Companies
          </div>
          <div className="text-2xl font-bold text-sky-500">{data.companiesCurrentlyHiring}</div>
          <div className="text-[10px] text-muted-foreground mt-1">Active Openings</div>
        </div>
        <div className={cardCls}>
          <div className="text-muted-foreground text-[11px] font-semibold mb-1">
            Jobs Posted (Month)
          </div>
          <div className="text-2xl font-bold text-violet-500">{data.jobsPostedThisMonth}</div>
          <div className="text-[10px] text-muted-foreground mt-1">Current Month</div>
        </div>
      </div>

      {/* Visual Charts & Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pipeline Stage Distribution */}
        <div className={cardCls + " space-y-4"}>
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-primary" /> Candidate Pipeline Stage Distribution
            </h3>
            <span className="text-xs text-muted-foreground font-mono">
              {totalStageCandidates} Total
            </span>
          </div>
          <div className="space-y-3">
            {data.pipelineStageDistribution.map((item) => {
              const pct =
                totalStageCandidates > 0
                  ? Math.round((item.count / totalStageCandidates) * 100)
                  : 0;
              let barColor = "bg-primary";
              if (item.stage === "Interview") barColor = "bg-amber-500";
              if (item.stage === "Offer") barColor = "bg-indigo-500";
              if (item.stage === "Hired") barColor = "bg-emerald-500";
              if (item.stage === "Rejected") barColor = "bg-rose-500";

              return (
                <div key={item.stage} className="space-y-1">
                  <div className="flex justify-between text-xs font-semibold">
                    <span>{item.stage}</span>
                    <span className="font-mono text-muted-foreground">
                      {item.count} ({pct}%)
                    </span>
                  </div>
                  <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full ${barColor} transition-all duration-500`}
                      style={{ width: `${Math.max(pct, item.count > 0 ? 3 : 0)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 6-Month Hiring Trends */}
        <div className={cardCls + " space-y-4"}>
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" /> 6-Month Platform Hiring Trends
            </h3>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-primary inline-block" /> Jobs Posted
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" /> Applicants
              </span>
            </div>
          </div>
          <div className="h-56 flex items-end justify-between gap-3 pt-6 pb-2 px-2 border-b border-border">
            {data.hiringTrends.map((t) => {
              const jobHeightPct = Math.round((t.jobsPosted / maxTrendVal) * 100);
              const candHeightPct = Math.round((t.candidatesApplied / maxTrendVal) * 100);

              return (
                <div
                  key={t.month}
                  className="flex-1 flex flex-col items-center gap-2 h-full justify-end group"
                >
                  <div className="flex items-end gap-1.5 w-full justify-center h-full">
                    <div
                      title={`Jobs Posted: ${t.jobsPosted}`}
                      className="w-1/2 max-w-[20px] bg-primary rounded-t-md transition-all duration-300 group-hover:brightness-110"
                      style={{ height: `${Math.max(jobHeightPct, t.jobsPosted > 0 ? 8 : 2)}%` }}
                    />
                    <div
                      title={`Candidates Applied: ${t.candidatesApplied}`}
                      className="w-1/2 max-w-[20px] bg-emerald-500 rounded-t-md transition-all duration-300 group-hover:brightness-110"
                      style={{
                        height: `${Math.max(candHeightPct, t.candidatesApplied > 0 ? 8 : 2)}%`,
                      }}
                    />
                  </div>
                  <span className="text-[11px] font-semibold text-muted-foreground font-mono">
                    {t.month}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Top Hiring Companies & Departments */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Hiring Companies */}
        <div className={cardCls + " space-y-4"}>
          <h3 className="font-bold text-sm flex items-center gap-2">
            <Building2 className="w-4 h-4 text-primary" /> Top Hiring Companies
          </h3>
          {data.topHiringCompanies.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">
              No active company hiring activity recorded.
            </p>
          ) : (
            <div className="space-y-2">
              {data.topHiringCompanies.map((c, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-muted/40 hover:bg-muted/70 transition"
                >
                  <div className="flex items-center gap-3">
                    <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary font-bold text-xs">
                      #{i + 1}
                    </div>
                    <div>
                      <div className="text-xs font-bold">{c.companyName}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {c.candidates} Total Candidates
                      </div>
                    </div>
                  </div>
                  <Badge tone="indigo">{c.openJobs} Open Jobs</Badge>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top Hiring Departments */}
        <div className={cardCls + " space-y-4"}>
          <h3 className="font-bold text-sm flex items-center gap-2">
            <Layers className="w-4 h-4 text-primary" /> Top Hiring Departments
          </h3>
          {data.topHiringDepartments.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">
              No department hiring metrics recorded.
            </p>
          ) : (
            <div className="space-y-2">
              {data.topHiringDepartments.map((d, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-muted/40 hover:bg-muted/70 transition"
                >
                  <div className="flex items-center gap-3">
                    <div className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-500/10 text-emerald-600 font-bold text-xs">
                      #{i + 1}
                    </div>
                    <div className="text-xs font-bold">{d.department}</div>
                  </div>
                  <Badge tone="green">{d.openJobs} Open Positions</Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

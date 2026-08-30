import React, { useState, useEffect, useRef } from "react";
import { RefreshCw, Database, ShieldAlert, FileText, Activity, HardDrive, Cpu, Server } from "lucide-react";
import { systemService, SystemMetrics } from "../../../services/system.service";

const cardCls =
  "rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)] transition hover:shadow-[var(--shadow-elevated)]";

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
        {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
      </div>
      {action && <div className="flex items-center gap-2">{action}</div>}
    </div>
  );
}

export function SystemMonitoringPage() {
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const inFlightRef = useRef(false);

  const fetchMetrics = async (isManual = false) => {
    if (inFlightRef.current) return;
    try {
      inFlightRef.current = true;
      if (isManual) setLoading(true);
      setError(null);
      const data = await systemService.getMetrics();
      if (data) {
        setMetrics(data);
      }
    } catch {
      setError("Failed to load real-time system metrics. Please check network connectivity.");
    } finally {
      setLoading(false);
      inFlightRef.current = false;
    }
  };

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(() => fetchMetrics(false), 15000);
    return () => {
      clearInterval(interval);
      inFlightRef.current = false;
    };
  }, []);

  return (
    <div className="space-y-6 w-full max-w-7xl mx-auto min-w-0 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <PageHeader
        title="System Monitoring & Infrastructure Health"
        subtitle="Real-time telemetry across database, servers, API endpoints, and queues"
        action={
          <button
            onClick={() => fetchMetrics(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-input bg-card px-3 py-1.5 text-xs font-semibold hover:bg-muted transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh Telemetry
          </button>
        }
      />

      {error ? (
        <div className="p-4 rounded-xl border border-destructive/30 bg-destructive/10 text-destructive text-sm font-semibold">
          {error}
        </div>
      ) : loading && !metrics ? (
        <div className="flex h-60 items-center justify-center">
          <div className="text-muted-foreground text-sm font-medium">Loading system metrics...</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Database Storage */}
          <div className={cardCls}>
            <div className="flex items-center gap-2 text-muted-foreground text-xs font-semibold mb-2">
              <Database className="w-4 h-4" /> Database Storage
            </div>
            <div className="text-2xl font-bold">{metrics?.dbSize ?? "--"}</div>
            <div className="text-xs text-[color:var(--color-success)] mt-1 font-medium">
              {metrics?.dbStatus ?? "Optimized"}
            </div>
          </div>

          {/* Resource Health */}
          <div className={cardCls}>
            <div className="flex items-center gap-2 text-muted-foreground text-xs font-semibold mb-2">
              <ShieldAlert className="w-4 h-4" /> Resource Health
            </div>
            <div
              className={`text-2xl font-bold ${
                metrics?.serverHealth === "Healthy"
                  ? "text-[color:var(--color-success)]"
                  : "text-destructive"
              }`}
            >
              {metrics?.serverHealth ?? "Healthy"}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Process Uptime: {metrics?.serverUptime ?? "Active"}
            </div>
          </div>

          {/* Node Process Memory */}
          <div className={cardCls}>
            <div className="flex items-center gap-2 text-muted-foreground text-xs font-semibold mb-2">
              <Cpu className="w-4 h-4" /> Node Process Memory
            </div>
            <div className="text-2xl font-bold">
              {metrics?.processMemory ?? (metrics?.ramUsage ? `${metrics.ramUsage} GB` : "--")}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              RSS: {metrics?.processRss ?? "N/A"} • {metrics?.processMemoryStatus ?? "Normal"}
            </div>
          </div>

          {/* Host Physical Memory */}
          <div className={cardCls}>
            <div className="flex items-center gap-2 text-muted-foreground text-xs font-semibold mb-2">
              <Server className="w-4 h-4" /> Host Physical Memory
            </div>
            <div className="text-2xl font-bold">
              {metrics?.hostMemory ?? (metrics?.ramTotal ? `${metrics.ramUsage} / ${metrics.ramTotal}` : "--")}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Status: {metrics?.hostMemoryStatus ?? metrics?.ramStatus ?? "Normal"}
            </div>
          </div>

          {/* Pending Outbox Events */}
          <div className={cardCls}>
            <div className="flex items-center gap-2 text-muted-foreground text-xs font-semibold mb-2">
              <FileText className="w-4 h-4" /> Pending Outbox Events
            </div>
            <div className="text-2xl font-bold">
              {metrics?.outboxQueue ?? metrics?.emailQueue ?? 0}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {metrics?.outboxQueueStatus ?? metrics?.emailQueueStatus ?? "Processing normally"}
            </div>
          </div>

          {/* API Health & Duration */}
          <div className={cardCls}>
            <div className="flex items-center gap-2 text-muted-foreground text-xs font-semibold mb-2">
              <Activity className="w-4 h-4" /> API Health
            </div>
            <div className="text-2xl font-bold text-[color:var(--color-success)]">
              {metrics?.apiStatus ?? "Operational"}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Health Check Duration: {metrics?.metricsDuration ?? metrics?.apiLatency ?? "0ms"}
            </div>
          </div>

          {/* Disk Storage */}
          <div className={cardCls}>
            <div className="flex items-center gap-2 text-muted-foreground text-xs font-semibold mb-2">
              <HardDrive className="w-4 h-4" /> Disk Storage
            </div>
            <div className="text-2xl font-bold">
              {metrics?.storageUsed && metrics?.storageTotal ? (
                <>
                  {metrics.storageUsed}{" "}
                  <span className="text-sm font-normal text-muted-foreground">
                    / {metrics.storageTotal}
                  </span>
                </>
              ) : (
                "N/A"
              )}
            </div>
            <div className="text-xs text-muted-foreground mt-1 font-medium">
              {metrics?.storageStatus ?? "Unavailable"}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import React, { useState, useEffect, useMemo } from "react";
import {
  RefreshCw,
  Download,
  FileText,
  Activity,
  ShieldAlert,
  RotateCcw,
  Clock,
  Building2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { notificationService } from "../../../services/notification.service";

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

export function AuditLogsPage({ toast }: { toast?: any }) {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const limit = 50;

  const [search, setSearch] = useState("");
  const [filterCompany, setFilterCompany] = useState("All");
  const [filterModule, setFilterModule] = useState("All");
  const [filterSeverity, setFilterSeverity] = useState("All");

  useEffect(() => {
    loadLogs(page);
  }, [page]);

  const loadLogs = async (pageToLoad: number = page) => {
    try {
      setLoading(true);
      const res = await notificationService.getAuditLogs({ page: pageToLoad, limit });
      setLogs(Array.isArray(res.data) ? res.data : []);
      setTotalPages(res.totalPages || 1);
      setTotalCount(res.total || 0);
    } catch {
      toast?.("Failed to load audit logs", "error");
    } finally {
      setLoading(false);
    }
  };

  const processedLogs = useMemo(() => {
    if (!Array.isArray(logs)) return [];
    return logs
      .filter((log) => log != null)
      .map((log) => {
        let company = "System";
        const actionLower = (log.action || "").toLowerCase();
        const detailsLower = (log.details || "").toLowerCase();
        const text = actionLower + " " + detailsLower;

        if (text.includes("globex")) company = "Globex Inc";
        else if (text.includes("stark")) company = "Stark Industries";
        else if (text.includes("acme")) company = "Acme Corp";

        let module = "System";
        let moduleTone: "slate" | "green" | "amber" | "rose" | "indigo" | "sky" = "slate";

        if (text.includes("company")) {
          module = "Company";
          moduleTone = "sky";
        } else if (text.includes("employee")) {
          module = "Employee";
          moduleTone = "green";
        } else if (text.includes("payroll")) {
          module = "Payroll";
          moduleTone = "amber";
        } else if (
          text.includes("auth") ||
          text.includes("login") ||
          text.includes("logout") ||
          text.includes("session")
        ) {
          module = "Auth";
          moduleTone = "indigo";
        } else if (text.includes("settings") || text.includes("policy")) {
          module = "Settings";
          moduleTone = "amber";
        } else if (text.includes("plan") || text.includes("subscription")) {
          module = "Plan";
          moduleTone = "sky";
        }

        let severity: "Info" | "Warning" | "Critical" = "Info";
        let severityTone: "green" | "amber" | "rose" = "green";

        if (
          text.includes("delete") ||
          text.includes("locked") ||
          text.includes("disabled") ||
          text.includes("failed") ||
          text.includes("error")
        ) {
          severity = "Critical";
          severityTone = "rose";
        } else if (
          text.includes("update") ||
          text.includes("logout") ||
          text.includes("change") ||
          text.includes("revoke")
        ) {
          severity = "Warning";
          severityTone = "amber";
        }

        const initials = (log.userName || "System User")
          .split(" ")
          .map((n: string) => n[0])
          .join("")
          .toUpperCase()
          .slice(0, 2);

        return {
          id: log.id,
          date: new Date(log.timestamp || Date.now()).toISOString().slice(0, 16).replace("T", " "),
          user: log.userName || "System",
          initials,
          company,
          module,
          moduleTone,
          severity,
          severityTone,
          action: log.action,
          details: log.details,
        };
      });
  }, [logs]);

  const filtered = useMemo(() => {
    return processedLogs.filter((log) => {
      if (filterCompany !== "All" && log.company !== filterCompany) return false;
      if (filterModule !== "All" && log.module !== filterModule) return false;
      if (filterSeverity !== "All" && log.severity !== filterSeverity) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const match =
          log.user.toLowerCase().includes(q) ||
          log.action.toLowerCase().includes(q) ||
          (log.details || "").toLowerCase().includes(q) ||
          log.company.toLowerCase().includes(q) ||
          log.module.toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [processedLogs, filterCompany, filterModule, filterSeverity, search]);

  const stats = useMemo(() => {
    const total = totalCount || processedLogs.length;
    const authCount = processedLogs.filter((l) => l.module === "Auth").length;
    const criticalCount = processedLogs.filter((l) => l.severity === "Critical").length;
    const uniqueUsers = new Set(processedLogs.map((l) => l.user)).size;
    return { total, authCount, criticalCount, uniqueUsers };
  }, [processedLogs, totalCount]);

  const exportLogsCsv = () => {
    if (!filtered.length) return;
    const headers = "ID,Timestamp,User,Company,Module,Severity,Action,Details\n";
    const rows = filtered
      .map(
        (l) =>
          `"${l.id}","${l.date}","${l.user}","${l.company}","${l.module}","${l.severity}","${l.action?.replace(/"/g, '""')}","${l.details?.replace(/"/g, '""')}"`,
      )
      .join("\n");
    const blob = new Blob([headers + rows], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    toast?.("Audit logs exported to CSV", "success");
  };

  return (
    <div className="space-y-6 w-full max-w-7xl mx-auto min-w-0 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <PageHeader
        title="System Audit Logs"
        subtitle="Real-time security auditing and event tracing across all tenant organizations"
        action={
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => loadLogs()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold hover:bg-muted transition"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
            <button
              onClick={exportLogsCsv}
              className="inline-flex items-center gap-1.5 rounded-lg btn-gradient px-3 py-1.5 text-xs font-semibold text-white shadow hover:opacity-95 transition"
            >
              <Download className="h-3.5 w-3.5" />
              Export CSV
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className={cardCls}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">Total Audit Events</span>
            <div className="grid h-8 w-8 place-items-center rounded-xl bg-primary/10 text-primary">
              <FileText className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-bold tracking-tight">{stats.total}</div>
          <div className="mt-1 text-[11px] text-muted-foreground flex items-center gap-1">
            <Activity className="h-3 w-3 text-emerald-500 animate-pulse" /> Live real-time audit
            stream
          </div>
        </div>
      </div>

      <div className={cardCls + " p-0 overflow-hidden"}>
        <div className="p-4 border-b border-border flex flex-wrap items-center gap-3 bg-muted/20">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search audit details..."
            className="rounded-lg border border-input bg-background px-3 py-1.5 text-xs outline-none w-full sm:w-64"
          />
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground">Company:</span>
            <select
              value={filterCompany}
              onChange={(e) => setFilterCompany(e.target.value)}
              className="rounded-lg border border-input bg-background px-2 py-1.5 text-xs outline-none"
            >
              <option value="All">All Companies</option>
              <option value="System">System</option>
              <option value="Globex Inc">Globex Inc</option>
              <option value="Stark Industries">Stark Industries</option>
              <option value="Acme Corp">Acme Corp</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground">Module:</span>
            <select
              value={filterModule}
              onChange={(e) => setFilterModule(e.target.value)}
              className="rounded-lg border border-input bg-background px-2 py-1.5 text-xs outline-none"
            >
              <option value="All">All Modules</option>
              <option value="Auth">Auth</option>
              <option value="Company">Company</option>
              <option value="Employee">Employee</option>
              <option value="Payroll">Payroll</option>
              <option value="Settings">Settings</option>
            </select>
          </div>
          {(filterCompany !== "All" ||
            filterModule !== "All" ||
            filterSeverity !== "All" ||
            search) && (
            <button
              onClick={() => {
                setFilterCompany("All");
                setFilterModule("All");
                setFilterSeverity("All");
                setSearch("");
              }}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-muted-foreground hover:text-foreground border border-border rounded-lg bg-card transition"
            >
              <RotateCcw className="h-3 w-3" /> Reset
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-xs border-collapse">
            <thead className="bg-muted/60 text-muted-foreground uppercase text-[11px] tracking-wider font-semibold border-b border-border">
              <tr>
                <th className="p-3.5 pl-4">Timestamp</th>
                <th className="p-3.5">User</th>
                <th className="p-3.5">Company</th>
                <th className="p-3.5">Module</th>
                <th className="p-3.5">Severity</th>
                <th className="p-3.5">Action Event</th>
                <th className="p-3.5 pr-4">Trace Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-muted-foreground">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <RefreshCw className="h-6 w-6 animate-spin text-primary" />
                      <span className="text-sm font-medium">Loading system audit traces...</span>
                    </div>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-muted-foreground">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <ShieldAlert className="h-8 w-8 text-muted-foreground/60" />
                      <span className="text-sm font-medium">No matching audit logs found</span>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((a) => (
                  <tr key={a.id} className="hover:bg-muted/30 transition-colors">
                    <td className="p-3.5 pl-4 whitespace-nowrap text-muted-foreground font-mono text-[11px]">
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-3 w-3 text-muted-foreground/70" />
                        <span>{a.date}</span>
                      </div>
                    </td>
                    <td className="p-3.5 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div className="grid h-6 w-6 place-items-center rounded-md bg-primary/10 text-primary text-[10px] font-bold">
                          {a.initials}
                        </div>
                        <span className="font-semibold text-foreground">{a.user}</span>
                      </div>
                    </td>
                    <td className="p-3.5 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 text-muted-foreground">
                        <Building2 className="h-3 w-3 text-muted-foreground/70" />
                        {a.company}
                      </span>
                    </td>
                    <td className="p-3.5 whitespace-nowrap">
                      <Badge tone={a.moduleTone}>{a.module}</Badge>
                    </td>
                    <td className="p-3.5 whitespace-nowrap">
                      <Badge tone={a.severityTone}>{a.severity}</Badge>
                    </td>
                    <td className="p-3.5 font-medium text-foreground max-w-xs truncate">
                      {a.action}
                    </td>
                    <td className="p-3.5 pr-4 text-muted-foreground max-w-md">
                      <div className="rounded border border-border/60 bg-muted/30 px-2 py-1 font-mono text-[11px] truncate">
                        {a.details || "No additional parameters logged"}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3 bg-muted/20">
          <div className="text-xs text-muted-foreground font-medium">
            Showing Page <span className="font-semibold text-foreground">{page}</span> of{" "}
            <span className="font-semibold text-foreground">{totalPages}</span> ({totalCount} total events)
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
              className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-2.5 py-1 text-xs font-semibold hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              <ChevronLeft className="h-3.5 w-3.5" /> Previous
            </button>
            <span className="text-xs font-semibold px-2">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || loading}
              className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-2.5 py-1 text-xs font-semibold hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              Next <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

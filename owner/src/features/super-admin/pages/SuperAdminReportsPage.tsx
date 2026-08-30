import React, { useState, useEffect, useMemo } from "react";
import {
  FileText,
  Download,
  BarChart2,
  BarChart3,
  TrendingUp,
  Users,
  Building2,
  ShieldCheck,
  DollarSign,
  Calendar,
  Filter,
  Search,
  Loader2,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { companyService } from "../../../services/company.service";
import { usersService } from "../../../services/users.service";
import { ticketsService } from "../../../services/tickets.service";
import {
  platformReportsService,
  PlatformReportType,
  GeneratedReportResult,
} from "../../../services/platform-reports.service";

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

function formatHeader(key: string) {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (str) => str.toUpperCase())
    .trim();
}

export function SuperAdminReportsPage({ toast }: { toast?: any }) {
  const [reportTypes, setReportTypes] = useState<PlatformReportType[]>([]);
  const [selectedType, setSelectedType] = useState<string>("company");
  const [search, setSearch] = useState<string>("");
  const [company, setCompany] = useState<string>("");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  const [reportResult, setReportResult] = useState<GeneratedReportResult | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [exporting, setExporting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState<number>(1);

  // Load report types on mount
  useEffect(() => {
    platformReportsService
      .getReportTypes()
      .then((types) => {
        if (Array.isArray(types) && types.length > 0) {
          setReportTypes(types);
        }
      })
      .catch(console.error);
  }, []);

  const loadReportData = async (newPage = 1) => {
    setLoading(true);
    setError(null);
    try {
      const res = await platformReportsService.generateReport({
        reportType: selectedType,
        search: search.trim() || undefined,
        company: company.trim() || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        page: newPage,
        limit: 25,
      });
      setReportResult(res);
      setPage(newPage);
    } catch (err: any) {
      setError(err?.message || "Failed to generate platform report");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadReportData(1);
  }, [selectedType]);

  const handleExport = async (format: "csv" | "excel" | "pdf") => {
    setExporting(format);
    try {
      await platformReportsService.downloadExport({
        reportType: selectedType,
        format,
        search: search.trim() || undefined,
        company: company.trim() || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      });
      if (toast)
        toast(`Platform ${selectedType} report exported as ${format.toUpperCase()}`, "success");
    } catch (err: any) {
      if (toast) toast(`Export failed: ${err?.message || "Download error"}`, "error");
    } finally {
      setExporting(null);
    }
  };

  const currentDef = reportTypes.find((r) => r.id === selectedType) || {
    title: selectedType.toUpperCase(),
    description: "Platform report",
    category: "General",
  };

  const previewData = reportResult?.data || [];
  const headers = previewData.length > 0 ? Object.keys(previewData[0]) : [];

  return (
    <div className="space-y-6 w-full max-w-7xl mx-auto min-w-0 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <PageHeader
        title="Global Platform Reports"
        subtitle="Generate and download aggregated platform reports across all SaaS companies"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => handleExport("csv")}
              disabled={!!exporting}
              className={btnCls + " !bg-emerald-600 hover:!bg-emerald-700 !text-white"}
            >
              <Download className="w-3.5 h-3.5 shrink-0" /> CSV
            </button>
            <button
              onClick={() => handleExport("excel")}
              disabled={!!exporting}
              className={btnCls + " !bg-indigo-600 hover:!bg-indigo-700 !text-white"}
            >
              <Download className="w-3.5 h-3.5 shrink-0" /> Excel (.xlsx)
            </button>
            <button
              onClick={() => handleExport("pdf")}
              disabled={!!exporting}
              className={btnCls + " !bg-violet-600 hover:!bg-violet-700 !text-white"}
            >
              <Download className="w-3.5 h-3.5 shrink-0" /> PDF / Printable
            </button>
          </div>
        }
      />

      {/* Report Selector Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5 sm:gap-3">
        {(reportTypes.length > 0
          ? reportTypes
          : [
              { id: "company", title: "Company Report", category: "Platform", description: "" },
              {
                id: "subscription",
                title: "Subscription Report",
                category: "Platform",
                description: "",
              },
              { id: "employee", title: "Employee Report", category: "Headcount", description: "" },
              { id: "revenue", title: "Revenue Report", category: "Financial", description: "" },
              { id: "payroll", title: "Payroll Summary", category: "Financial", description: "" },
              {
                id: "attendance",
                title: "Attendance Summary",
                category: "Operations",
                description: "",
              },
              { id: "leave", title: "Leave Summary", category: "Operations", description: "" },
              {
                id: "recruitment",
                title: "Recruitment Summary",
                category: "Hiring",
                description: "",
              },
              {
                id: "storage",
                title: "Storage Usage",
                category: "Infrastructure",
                description: "",
              },
              { id: "audit_log", title: "Audit Log Report", category: "Security", description: "" },
            ]
        ).map((rt) => {
          const isSelected = selectedType === rt.id;
          return (
            <button
              key={rt.id}
              onClick={() => setSelectedType(rt.id)}
              className={`flex flex-col text-left p-3 sm:p-3.5 rounded-xl border transition min-w-0 ${
                isSelected
                  ? "border-primary bg-primary/10 shadow-sm"
                  : "border-border bg-card hover:bg-muted/40 text-muted-foreground hover:text-foreground"
              }`}
            >
              <div className="flex items-center gap-2 font-bold text-xs min-w-0">
                <BarChart3
                  className={`w-3.5 h-3.5 shrink-0 ${isSelected ? "text-primary" : "text-muted-foreground"}`}
                />
                <span className="truncate">{rt.title}</span>
              </div>
              <span className="text-[10px] text-muted-foreground mt-1 truncate">{rt.category}</span>
            </button>
          );
        })}
      </div>

      {/* Filter Toolbar */}
      <div className={cardCls + " p-4 space-y-4"}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
          <div className="min-w-0">
            <h2 className="text-base font-bold flex flex-wrap items-center gap-2">
              <span>{currentDef.title}</span>
              <Badge tone="indigo">{reportResult?.metadata?.totalRecords || 0} Total Records</Badge>
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">{currentDef.description}</p>
          </div>
          {reportResult?.metadata && (
            <div className="text-[11px] font-mono text-muted-foreground text-left sm:text-right">
              <div>
                Generated: {new Date(reportResult.metadata.generatedAt).toLocaleTimeString()}
              </div>
              <div>By: {reportResult.metadata.generatedBy}</div>
            </div>
          )}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void loadReportData(1);
          }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3"
        >
          <div className="relative min-w-0">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search data records..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={inputCls + " pl-9"}
            />
          </div>

          <div className="min-w-0">
            <input
              type="text"
              placeholder="Filter by company..."
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              className={inputCls}
            />
          </div>

          <div className="min-w-0">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className={inputCls}
            />
          </div>

          <div className="flex gap-2 min-w-0">
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className={inputCls + " flex-1 min-w-0"}
            />
            <button type="submit" className={btnCls + " shrink-0"}>
              <Filter className="w-3.5 h-3.5" /> Filter
            </button>
          </div>
        </form>
      </div>

      {/* Data Preview Table */}
      <div className={cardCls + " p-0 overflow-hidden"}>
        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm font-medium text-muted-foreground">
                Aggregating live platform metrics...
              </p>
            </div>
          </div>
        ) : error ? (
          <div className="p-8 text-center space-y-3">
            <AlertCircle className="w-10 h-10 text-destructive mx-auto" />
            <p className="text-sm font-medium text-destructive">{error}</p>
            <button onClick={() => void loadReportData(1)} className={btnCls}>
              <RefreshCw className="w-3.5 h-3.5" /> Retry
            </button>
          </div>
        ) : previewData.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground space-y-2">
            <BarChart3 className="w-10 h-10 mx-auto opacity-20" />
            <p className="text-sm">No data records found matching your filters.</p>
          </div>
        ) : (
          <div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    {headers.map((h) => (
                      <th
                        key={h}
                        className="p-3 font-semibold text-muted-foreground uppercase tracking-wider text-[10px]"
                      >
                        {formatHeader(h)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {previewData.map((row, idx) => (
                    <tr key={idx} className="hover:bg-muted/30 transition">
                      {headers.map((h) => (
                        <td key={h} className="p-3 font-medium text-foreground whitespace-nowrap">
                          {row[h] !== undefined && row[h] !== null ? String(row[h]) : "-"}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {reportResult?.metadata && reportResult.metadata.totalPages > 1 && (
              <div className="flex items-center justify-between p-3 border-t border-border bg-muted/20 text-xs">
                <span className="text-muted-foreground font-mono">
                  Page {reportResult.metadata.page} of {reportResult.metadata.totalPages} (
                  {reportResult.metadata.totalRecords} total items)
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => void loadReportData(page - 1)}
                    disabled={page <= 1}
                    className={
                      btnCls + " !bg-secondary !text-secondary-foreground disabled:opacity-50"
                    }
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => void loadReportData(page + 1)}
                    disabled={page >= reportResult.metadata.totalPages}
                    className={
                      btnCls + " !bg-secondary !text-secondary-foreground disabled:opacity-50"
                    }
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

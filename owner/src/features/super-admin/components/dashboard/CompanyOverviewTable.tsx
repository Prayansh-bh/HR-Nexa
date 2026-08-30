import React from "react";
import {
  Edit3,
  Lock,
  Play,
  Wallet,
  CalendarCheck,
  CalendarDays,
  Briefcase,
  ShieldCheck,
  Filter,
} from "lucide-react";
import type { SaaSCompany } from "../../types/superAdmin.types";

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

interface CompanyOverviewTableProps {
  payrollStats: { completed: number; pending: number; failed: number };
  attendanceStats: { present: number; absent: number; onLeave: number; late: number };
  leaveStats: { approved: number; pending: number; rejected: number };
  recruitmentStats: {
    jobsCount: number;
    candidatesCount: number;
    interviewsScheduled: number;
    offersSent: number;
  };
  companies: SaaSCompany[];
  paginatedCompanies: SaaSCompany[];
  currentPage: number;
  totalPages: number;
  pageSize: number;
  filteredCompaniesCount: number;
  onPageChange: (newPage: number) => void;
  onEditCompany: (company: SaaSCompany) => void;
  onToggleSuspend: (company: SaaSCompany) => void;
  onImpersonate: (company: SaaSCompany) => void;
  payments: Array<{ companyName?: string; company?: string; amount: number; status: string }>;
  planFilter?: string;
  statusFilter?: string;
  onPlanFilterChange?: (plan: string) => void;
  onStatusFilterChange?: (status: string) => void;
}

export const CompanyOverviewTable: React.FC<CompanyOverviewTableProps> = ({
  payrollStats,
  attendanceStats,
  leaveStats,
  recruitmentStats,
  companies,
  paginatedCompanies,
  currentPage,
  totalPages,
  pageSize,
  filteredCompaniesCount,
  onPageChange,
  onEditCompany,
  onToggleSuspend,
  onImpersonate,
  payments,
  planFilter = "All",
  statusFilter = "All",
  onPlanFilterChange,
  onStatusFilterChange,
}) => {
  return (
    <div className="space-y-6">
      {/* Summaries of Tenant Activity (Payroll, Attendance, Leave, Recruitment, Compliance) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        <div className={cardCls + " flex flex-col justify-between"}>
          <div className="mb-2">
            <span className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-1">
              <Wallet className="h-3.5 w-3.5 text-primary shrink-0" /> Payroll Activity
            </span>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span>Completed</span>
              <span className="font-bold text-emerald-500">{payrollStats.completed} Slips</span>
            </div>
            <div className="flex justify-between text-xs">
              <span>Pending</span>
              <span className="font-bold text-amber-500">{payrollStats.pending} Slips</span>
            </div>
            <div className="flex justify-between text-xs">
              <span>Failed</span>
              <span className="font-bold text-destructive">{payrollStats.failed} Slips</span>
            </div>
          </div>
        </div>

        <div className={cardCls + " flex flex-col justify-between"}>
          <div className="mb-2">
            <span className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-1">
              <CalendarCheck className="h-3.5 w-3.5 text-success shrink-0" /> Attendance
            </span>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span>Present</span>
              <span className="font-bold text-emerald-500">
                {attendanceStats.present} Employees
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span>Absent</span>
              <span className="font-bold text-rose-500">{attendanceStats.absent} Employees</span>
            </div>
            <div className="flex justify-between text-xs">
              <span>On Leave</span>
              <span className="font-bold text-indigo-500">{attendanceStats.onLeave} Employees</span>
            </div>
            <div className="flex justify-between text-xs">
              <span>Late</span>
              <span className="font-bold text-amber-500">{attendanceStats.late} Employees</span>
            </div>
          </div>
        </div>

        <div className={cardCls + " flex flex-col justify-between"}>
          <div className="mb-2">
            <span className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-1">
              <CalendarDays className="h-3.5 w-3.5 text-amber-500 shrink-0" /> Leave Summary
            </span>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span>Approved</span>
              <span className="font-bold text-emerald-500">{leaveStats.approved} Approved</span>
            </div>
            <div className="flex justify-between text-xs">
              <span>Pending</span>
              <span className="font-bold text-amber-500">{leaveStats.pending} Pending</span>
            </div>
            <div className="flex justify-between text-xs">
              <span>Rejected</span>
              <span className="font-bold text-rose-500">{leaveStats.rejected} Rejected</span>
            </div>
          </div>
        </div>

        <div className={cardCls + " flex flex-col justify-between"}>
          <div className="mb-2">
            <span className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-1">
              <Briefcase className="h-3.5 w-3.5 text-indigo-500 shrink-0" /> Recruitment
            </span>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span>Open Jobs</span>
              <span className="font-bold">{recruitmentStats.jobsCount} positions</span>
            </div>
            <div className="flex justify-between text-xs">
              <span>Candidates</span>
              <span className="font-bold">{recruitmentStats.candidatesCount} candidates</span>
            </div>
            <div className="flex justify-between text-xs">
              <span>Interviews</span>
              <span className="font-bold text-amber-500">
                {recruitmentStats.interviewsScheduled} scheduled
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span>Offers Made</span>
              <span className="font-bold text-emerald-500">{recruitmentStats.offersSent} sent</span>
            </div>
          </div>
        </div>

        <div className={cardCls + " flex flex-col justify-between"}>
          <div className="mb-2">
            <span className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-1">
              <ShieldCheck className="h-3.5 w-3.5 text-teal-500 shrink-0" /> Compliance Status
            </span>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span>PF ECR Filing</span>
              <span className="font-semibold text-muted-foreground text-[11px]">Not Integrated</span>
            </div>
            <div className="flex justify-between text-xs">
              <span>ESI Portal Filing</span>
              <span className="font-semibold text-muted-foreground text-[11px]">Not Integrated</span>
            </div>
            <div className="flex justify-between text-xs">
              <span>TDS 24Q e-Filing</span>
              <span className="font-semibold text-muted-foreground text-[11px]">Not Integrated</span>
            </div>
            <div className="flex justify-between text-xs text-rose-500 font-semibold">
              <span>Expired Tenancies</span>
              <span>{companies.filter((c) => c.status === "Expired").length} {companies.filter((c) => c.status === "Expired").length === 1 ? "tenant" : "tenants"}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Companies Table & Latest Payments Table */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className={cardCls + " lg:col-span-2 overflow-hidden flex flex-col justify-between"}>
          <div>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-foreground">Recent Companies</h3>
                <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                  {filteredCompaniesCount} {filteredCompaniesCount === 1 ? "tenant" : "tenants"}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {(onPlanFilterChange || onStatusFilterChange) && (
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 text-xs font-semibold text-muted-foreground">
                      <Filter className="h-3 w-3" /> Filters:
                    </div>
                    {onPlanFilterChange && (
                      <select
                        value={planFilter}
                        onChange={(e) => onPlanFilterChange(e.target.value)}
                        className="rounded-lg border border-border bg-background p-1.5 text-xs outline-none focus:ring-1 focus:ring-primary"
                        aria-label="Filter companies by plan"
                      >
                        <option value="All">All Plans</option>
                        <option value="Basic">Basic</option>
                        <option value="Standard">Standard</option>
                        <option value="Premium">Premium</option>
                      </select>
                    )}
                    {onStatusFilterChange && (
                      <select
                        value={statusFilter}
                        onChange={(e) => onStatusFilterChange(e.target.value)}
                        className="rounded-lg border border-border bg-background p-1.5 text-xs outline-none focus:ring-1 focus:ring-primary"
                        aria-label="Filter companies by status"
                      >
                        <option value="All">All Statuses</option>
                        <option value="Active">Active</option>
                        <option value="Trial">Trial</option>
                        <option value="Expired">Expired</option>
                        <option value="Suspended">Suspended</option>
                      </select>
                    )}
                  </div>
                )}
                <span className="text-xs text-muted-foreground">
                  Showing {filteredCompaniesCount === 0 ? 0 : (currentPage - 1) * pageSize + 1}-
                  {Math.min(currentPage * pageSize, filteredCompaniesCount)} of {filteredCompaniesCount}
                </span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border bg-muted/30 text-muted-foreground">
                    <th className="p-3">Company Name</th>
                    <th className="p-3">Subscription</th>
                    <th className="p-3 text-right">Headcount</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedCompanies.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center p-8 text-muted-foreground">
                        No companies match filters.
                      </td>
                    </tr>
                  ) : (
                    paginatedCompanies.map((c) => (
                      <tr key={c.id} className="border-b border-border hover:bg-muted/10 transition">
                        <td className="p-3 font-semibold text-foreground">
                          <div>{c.name}</div>
                          <div className="text-[10px] text-muted-foreground font-normal">
                            {c.ownerEmail}
                          </div>
                        </td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${c.plan === "Premium" ? "bg-amber-100 text-amber-800" : c.plan === "Standard" ? "bg-indigo-100 text-indigo-800" : "bg-slate-100 text-slate-800"}`}
                          >
                            {c.plan}
                          </span>
                        </td>
                        <td className="p-3 text-right font-bold text-foreground">{c.employeesCount}</td>
                        <td className="p-3">
                          <LocalBadge
                            tone={
                              c.status === "Active"
                                ? "green"
                                : c.status === "Trial"
                                  ? "amber"
                                  : c.status === "Expired"
                                    ? "rose"
                                    : "slate"
                            }
                          >
                            {c.status}
                          </LocalBadge>
                        </td>
                        <td className="p-3 text-right space-x-1 whitespace-nowrap">
                          <button
                            onClick={() => onEditCompany(c)}
                            className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                            title="Edit Company Details"
                          >
                            <Edit3 className="h-3.5 w-3.5 inline text-indigo-500" />
                          </button>
                          <button
                            onClick={() => onToggleSuspend(c)}
                            className={`p-1 rounded hover:bg-muted font-bold ${c.status === "Suspended" ? "text-emerald-500" : "text-rose-500"}`}
                            title={c.status === "Suspended" ? "Activate Account" : "Suspend Account"}
                          >
                            <Lock className="h-3.5 w-3.5 inline" />
                          </button>
                          {c.status === "Active" || c.status === "Trial" ? (
                            <button
                              onClick={() => onImpersonate(c)}
                              className="p-1 rounded bg-primary/10 text-primary hover:bg-primary hover:text-white transition text-[10px] px-2 font-bold"
                              title="Login as HR Admin"
                            >
                              <Play className="h-3 w-3 inline mr-0.5" /> Login
                            </button>
                          ) : (
                            <button
                              disabled
                              className="p-1 rounded bg-muted text-muted-foreground opacity-40 cursor-not-allowed text-[10px] px-2 font-bold"
                              title={`Cannot impersonate ${c.status.toLowerCase()} company`}
                            >
                              <Play className="h-3 w-3 inline mr-0.5" /> Login
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
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-end gap-1">
              <button
                disabled={currentPage === 1}
                onClick={() => onPageChange(currentPage - 1)}
                className="px-2 py-1 text-xs border border-border rounded disabled:opacity-40 hover:bg-muted"
              >
                Prev
              </button>
              <span className="text-xs text-muted-foreground px-2">
                Page {currentPage} of {totalPages}
              </span>
              <button
                disabled={currentPage === totalPages}
                onClick={() => onPageChange(currentPage + 1)}
                className="px-2 py-1 text-xs border border-border rounded disabled:opacity-40 hover:bg-muted"
              >
                Next
              </button>
            </div>
          )}
        </div>

        <div className={cardCls + " overflow-hidden flex flex-col justify-between"}>
          <div>
            <h3 className="mb-4 text-sm font-bold text-foreground">Latest Payments</h3>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[260px] text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border bg-muted/30 text-muted-foreground">
                    <th className="p-3">Company</th>
                    <th className="p-3 text-right">Amount</th>
                    <th className="p-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.slice(0, 6).map((p, idx) => (
                    <tr key={idx} className="border-b border-border hover:bg-muted/10 transition">
                      <td className="p-3 font-semibold">{p.companyName || p.company}</td>
                      <td className="p-3 text-right font-bold text-foreground">
                        ₹{p.amount.toLocaleString()}
                      </td>
                      <td className="p-3">
                        <LocalBadge
                          tone={
                            p.status === "Paid"
                              ? "green"
                              : p.status === "Outstanding"
                                ? "amber"
                                : "rose"
                          }
                        >
                          {p.status}
                        </LocalBadge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

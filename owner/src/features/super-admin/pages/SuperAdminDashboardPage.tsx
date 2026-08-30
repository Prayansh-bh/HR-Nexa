import React, { useState, useMemo, useEffect, useRef } from "react";
import { getBusinessDateString } from "../../../utils/date.utils";
import { Search, FileSpreadsheet, Plus, Building2, MessageSquare } from "lucide-react";
import { exportToExcel } from "../../../utils/excelExporter";
import type { SaaSCompany, SaaSInvoice, SaaSSupportTicket } from "../types/superAdmin.types";
import {
  deriveDefaultAnnouncements,
  calculatePayrollActivity,
  calculateAttendanceMetrics,
  calculateLeaveSummary,
  calculateRenewalsDueMetrics,
  calculateRevenueTrendData,
  calculateMoMCompanyGrowth,
  calculateCompanyGrowthMonthlyTrend,
  calculateEmployeeSeatMetrics,
  calculateEmployeeGrowthTrend,
} from "../utils/superAdminDataHelper";

import { useCompaniesQuery, useCompanyMutations } from "../../../hooks/useCompaniesQuery";
import { usePlansQuery, usePlanMutations } from "../../../hooks/usePlansQuery";
import { useEmployeesQuery } from "../../../hooks/useEmployeesQuery";
import { useAttendanceQuery } from "../../../hooks/useAttendanceQuery";
import { useLeavesQuery } from "../../../hooks/useLeavesQuery";
import { usePayrollQuery } from "../../../hooks/usePayrollQuery";
import { useAuditLogsQuery, useAuditLogsMutations } from "../../../hooks/useAuditLogsQuery";
import {
  useSubscriptionStatsQuery,
  useInvoicesQuery,
  useTicketsQuery,
  useRecruitmentOverviewQuery,
  useAnnouncementsQuery,
  useDashboardMutations,
  useSubscriptionMutations,
} from "../../../hooks/useDashboardQueries";
import { useSuperAdminDashboardQuery } from "../../../hooks/useSuperAdminDashboardQuery";
import { useSystemSettingsQuery } from "../../../hooks/useSystemSettingsQuery";
import { authService } from "../../../services/auth.service";
import { useNavigate } from "@tanstack/react-router";
import { useAuthStore } from "../../../store/authStore";
import { OWNER_STORAGE_KEYS } from "../../../config/storage";

import { DashboardSummaryCards } from "../components/dashboard/DashboardSummaryCards";
import { RevenueGrowthCharts } from "../components/dashboard/RevenueGrowthCharts";
import { CompanyOverviewTable } from "../components/dashboard/CompanyOverviewTable";
import { QuickActionsPanel } from "../components/dashboard/QuickActionsPanel";
import { RenewalsAndAnnouncements } from "../components/dashboard/RenewalsAndAnnouncements";

import { OnboardCompanyModal } from "../components/modals/OnboardCompanyModal";
import { EditCompanyModal } from "../components/modals/EditCompanyModal";
import { CreateSubscriptionModal } from "../components/modals/CreateSubscriptionModal";
import { GenerateInvoiceModal } from "../components/modals/GenerateInvoiceModal";
import { CreateTicketModal } from "../components/modals/CreateTicketModal";
import { BroadcastAnnouncementModal } from "../components/modals/BroadcastAnnouncementModal";
import { ManagePlansModal } from "../components/modals/ManagePlansModal";
import { ViewAuditLogsModal } from "../components/modals/ViewAuditLogsModal";
import { SystemSettingsModal } from "../components/modals/SystemSettingsModal";

const inputCls =
  "h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20";

function Btn({
  children,
  onClick,
  variant = "primary",
  size = "md",
  className = "",
  type = "button",
  disabled,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "ghost" | "outline" | "danger" | "success";
  size?: "sm" | "md";
  className?: string;
  type?: "button" | "submit";
  disabled?: boolean;
}) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition duration-200 hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0";
  const sizes = { sm: "px-3 py-1.5 text-xs", md: "px-4 py-2 text-sm" };
  const variants = {
    primary: "btn-gradient hover:brightness-110 text-white",
    success: "bg-[color:var(--color-success)] text-white shadow-md hover:brightness-110",
    ghost: "text-muted-foreground hover:bg-muted hover:text-foreground",
    outline: "border border-border bg-card hover:border-primary hover:text-primary text-foreground",
    danger: "bg-destructive text-destructive-foreground shadow-md hover:brightness-110",
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

export function SuperAdminDashboardPage({
  toast,
  setUser,
}: {
  toast: (m: string, tone?: "success" | "error" | "info") => void;
  setUser: any;
}) {
  const navigate = useNavigate();
  const { companies } = useCompaniesQuery();
  const { plans } = usePlansQuery();
  const mutations = useCompanyMutations();
  const planMutations = usePlanMutations();
  const dashboardMutations = useDashboardMutations();
  const subscriptionMutations = useSubscriptionMutations();

  const { data: subscriptionStats } = useSubscriptionStatsQuery();
  const { data: invoicesData } = useInvoicesQuery();
  const invoices: SaaSInvoice[] = useMemo(() => {
    const rawList = Array.isArray(invoicesData?.data)
      ? invoicesData.data
      : Array.isArray(invoicesData)
      ? invoicesData
      : [];
    return rawList.map((inv: any) => ({
      ...inv,
      companyName: inv.companyName || inv.company || "Company",
    }));
  }, [invoicesData]);

  const { data: ticketsData } = useTicketsQuery();
  const tickets: SaaSSupportTicket[] = useMemo(() => {
    return (ticketsData || []).map((t: any) => ({
      ...t,
      companyName: t.companyName || t.company || "Company",
    }));
  }, [ticketsData]);

  const { data: recOverview } = useRecruitmentOverviewQuery();
  const recruitmentStats = useMemo(
    () => ({
      jobsCount: recOverview?.totalOpenJobs ?? 0,
      candidatesCount: recOverview?.totalCandidates ?? 0,
      interviewsScheduled: recOverview?.interviewsScheduled ?? 0,
      offersSent: recOverview?.offersSent ?? 0,
    }),
    [recOverview],
  );

  const { data: systemAnnouncements } = useAnnouncementsQuery();
  const announcements = useMemo(() => {
    if (Array.isArray(systemAnnouncements) && systemAnnouncements.length > 0) {
      return systemAnnouncements;
    }
    return deriveDefaultAnnouncements(companies);
  }, [systemAnnouncements, companies]);

  const { data: employeesData } = useEmployeesQuery();
  const employees = employeesData || [];

  const { data: attendanceData } = useAttendanceQuery();
  const attendanceRecords = attendanceData || [];

  const { data: leavesData } = useLeavesQuery();
  const leaves = leavesData || [];

  const { data: payrollData } = usePayrollQuery();
  const salarySlips = payrollData || [];

  const { data: auditLogsData } = useAuditLogsQuery();
  const auditLogs = (auditLogsData as any)?.data || (Array.isArray(auditLogsData) ? auditLogsData : []);

  const { data: aggregatorStats, isLoading: aggregatorLoading } = useSuperAdminDashboardQuery();
  const { data: systemSettings } = useSystemSettingsQuery();

  // Subscription metrics are backend-authoritative.
  // Do not calculate revenue in the frontend.
  const subscriptions = aggregatorStats?.subscriptions;
  const isRevenueLoading = aggregatorLoading || !subscriptions;
  const mrr = subscriptions?.mrr ?? 0;
  const arr = subscriptions?.arr ?? 0;

  const auditLogMutations = useAuditLogsMutations();
  const logAction = async (action: string, details: string) => {
    try {
      await auditLogMutations.logAction.mutateAsync({ action, details });
    } catch (err) {
      console.error("Failed to log audit action:", err);
    }
  };

  const payrollStats = useMemo(() => calculatePayrollActivity(salarySlips), [salarySlips]);
  const attendanceStats = useMemo(
    () => calculateAttendanceMetrics(attendanceRecords),
    [attendanceRecords],
  );
  const leaveStats = useMemo(() => calculateLeaveSummary(leaves), [leaves]);

  const renewalsDueAmount = useMemo(
    () => calculateRenewalsDueMetrics(companies, invoices),
    [companies, invoices],
  );
  const revenueTrendPoints = useMemo(
    () => calculateRevenueTrendData(mrr, invoices),
    [mrr, invoices],
  );
  const momGrowthStr = useMemo(() => calculateMoMCompanyGrowth(companies), [companies]);
  const companyGrowthBars = useMemo(
    () => calculateCompanyGrowthMonthlyTrend(companies),
    [companies],
  );
  const seatMetrics = useMemo(
    () => calculateEmployeeSeatMetrics(companies, employees),
    [companies, employees],
  );
  const empGrowthTrend = useMemo(() => calculateEmployeeGrowthTrend(employees), [employees]);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const [planFilter, setPlanFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 5;

  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [editingCompany, setEditingCompany] = useState<SaaSCompany | null>(null);

  // Form states for modals
  const [newCompany, setNewCompany] = useState<{
    name: string;
    plan: "Basic" | "Standard" | "Premium";
    employeesCount: number;
    status: "Active" | "Trial" | "Expired" | "Suspended";
    ownerName: string;
    ownerEmail: string;
    purchasedSeats: number;
  }>({
    name: "",
    plan: "Basic",
    employeesCount: 15,
    status: "Active",
    ownerName: "",
    ownerEmail: "",
    purchasedSeats: 20,
  });

  const [newInvoice, setNewInvoice] = useState<{
    companyName: string;
    amount: number;
    status: "Paid" | "Pending" | "Overdue";
  }>({
    companyName: "",
    amount: 15000,
    status: "Paid",
  });

  const [newTicket, setNewTicket] = useState<{
    companyName: string;
    subject: string;
    priority: "Low" | "Medium" | "High" | "Critical";
  }>({
    companyName: "",
    subject: "",
    priority: "High",
  });

  const [newAnnouncement, setNewAnnouncement] = useState<{
    type: string;
    title: string;
    content: string;
    scheduledFor?: string;
    duration?: string;
  }>({
    type: "Maintenance",
    title: "",
    content: "",
    scheduledFor: "",
    duration: "2 Hours",
  });

  const [newPlan, setNewPlan] = useState<{
    name: string;
    price: number;
    yearlyPrice?: number;
    employeeLimit: number;
  }>({
    name: "Standard",
    price: 42000,
    yearlyPrice: 420000,
    employeeLimit: 50,
  });

  const filteredCompanies = useMemo(() => {
    const q = (searchQuery || "").toLowerCase();
    const norm = (s: string) => {
      const str = String(s || "")
        .trim()
        .toLowerCase();
      if (str === "paid" || str === "active") return "active";
      return str;
    };
    return companies.filter((c) => {
      const matchSearch =
        !q ||
        String(c.name || "")
          .toLowerCase()
          .includes(q) ||
        String(c.ownerName || "")
          .toLowerCase()
          .includes(q) ||
        String(c.ownerEmail || "")
          .toLowerCase()
          .includes(q) ||
        String(c.plan || "")
          .toLowerCase()
          .includes(q) ||
        String(c.id || "")
          .toLowerCase()
          .includes(q);
      const matchPlan =
        planFilter === "All" ||
        String(c.plan || "")
          .toLowerCase()
          .includes(planFilter.toLowerCase());
      const matchStatus = statusFilter === "All" || norm(c.status) === norm(statusFilter);
      return matchSearch && matchPlan && matchStatus;
    });
  }, [companies, searchQuery, planFilter, statusFilter]);

  const filteredInvoices = useMemo(() => {
    const q = (searchQuery || "").toLowerCase();
    if (!q) return invoices;
    return invoices.filter(
      (i) =>
        String(i.id || "")
          .toLowerCase()
          .includes(q) ||
        String(i.companyName || i.company || "")
          .toLowerCase()
          .includes(q) ||
        String(i.amount || "")
          .toLowerCase()
          .includes(q) ||
        String(i.status || "")
          .toLowerCase()
          .includes(q),
    );
  }, [invoices, searchQuery]);

  const filteredTickets = useMemo(() => {
    const q = (searchQuery || "").toLowerCase();
    if (!q) return tickets;
    return tickets.filter(
      (t) =>
        String(t.subject || "")
          .toLowerCase()
          .includes(q) ||
        String(t.companyName || t.company || "")
          .toLowerCase()
          .includes(q) ||
        String(t.priority || "")
          .toLowerCase()
          .includes(q) ||
        String(t.status || "")
          .toLowerCase()
          .includes(q),
    );
  }, [tickets, searchQuery]);

  const paginatedCompanies = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredCompanies.slice(start, start + pageSize);
  }, [filteredCompanies, currentPage]);

  const totalPages = Math.ceil(filteredCompanies.length / pageSize);

  const activeCompanies = useMemo(
    () => companies.filter((c) => c.status === "Active").length,
    [companies],
  );
  const trialCompanies = useMemo(
    () => companies.filter((c) => c.status === "Trial").length,
    [companies],
  );

  const openTickets = useMemo(() => tickets.filter((t) => t.status === "Open").length, [tickets]);
  const criticalTickets = useMemo(
    () => tickets.filter((t) => t.priority === "Critical").length,
    [tickets],
  );

  const openTicketsValue = aggregatorStats?.support?.openTickets ?? openTickets;
  const criticalTicketsValue = aggregatorStats?.support?.criticalTickets ?? criticalTickets;
  const systemUptimeValue = aggregatorStats?.system?.serverUptime ?? "99.98%";

  // Handlers
  const handleAddCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (Number(newCompany.employeesCount) > Number(newCompany.purchasedSeats)) {
      toast("Initial Headcount cannot exceed Purchased Seat Limit", "error");
      return;
    }
    try {
      const created = await mutations.createCompany.mutateAsync({
        name: newCompany.name,
        plan: newCompany.plan,
        status: newCompany.status,
        ownerName: newCompany.ownerName || "Default Contact",
        ownerEmail: newCompany.ownerEmail,
        purchasedSeats: Number(newCompany.purchasedSeats),
        usedSeats: Number(newCompany.employeesCount),
        employeesCount: Number(newCompany.employeesCount),
      });
      void logAction("Create Company", `Added new company ${created.name} (${created.plan} plan)`);
      setActiveModal(null);
      toast("Company successfully added", "success");
    } catch (err: any) {
      toast(err?.message || "Failed to add company", "error");
    }
  };

  const handleEditCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCompany) return;
    try {
      await mutations.editProfile.mutateAsync({ id: editingCompany.id, data: editingCompany });
      void logAction("Edit Company", `Updated details for ${editingCompany.name}`);
      setEditingCompany(null);
      toast(`Company ${editingCompany.name} updated`, "success");
    } catch (err: any) {
      toast(err?.message || "Failed to update company", "error");
    }
  };

  const handleAddInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await dashboardMutations.createInvoice.mutateAsync(newInvoice);
      void logAction(
        "Generate Invoice",
        `Generated ₹${newInvoice.amount} invoice for ${newInvoice.companyName}`,
      );
      setActiveModal(null);
      toast("Invoice successfully generated", "success");
    } catch (err: any) {
      toast(err?.message || "Failed to generate invoice", "error");
    }
  };

  const handleAddTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await dashboardMutations.createTicket.mutateAsync({
        ...newTicket,
        status: "Open",
      });
      void logAction(
        "Open Support Ticket",
        `Opened ${newTicket.priority} priority ticket for ${newTicket.companyName}`,
      );
      setActiveModal(null);
      toast("Support ticket opened successfully", "success");
    } catch (err: any) {
      toast(err?.message || "Failed to open support ticket", "error");
    }
  };

  const handleAddAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await dashboardMutations.createAnnouncement.mutateAsync(newAnnouncement);
      void logAction(
        "Broadcast Notice",
        `Published ${newAnnouncement.type} announcement: ${newAnnouncement.title}`,
      );
      setActiveModal(null);
      toast("Announcement broadcasted successfully", "success");
    } catch (err: any) {
      toast(err?.message || "Failed to broadcast announcement", "error");
    }
  };

  const handleUpdatePricingPlan = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await planMutations.updatePlan.mutateAsync({
        name: newPlan.name,
        payload: {
          monthlyPrice: Number(newPlan.price),
          yearlyPrice: newPlan.yearlyPrice !== undefined ? Number(newPlan.yearlyPrice) : undefined,
          price: `₹${newPlan.price}/mo`,
          employeeLimit: Number(newPlan.employeeLimit),
        },
      });
      void logAction(
        "Manage Pricing",
        `Updated pricing for ${newPlan.name} plan to ₹${newPlan.price}/mo (${newPlan.employeeLimit} seats)`,
      );
      toast(`${newPlan.name} plan pricing updated successfully`, "success");
      setActiveModal(null);
    } catch (err: any) {
      toast(err?.message || "Failed to update plan pricing", "error");
    }
  };

  const handleToggleSuspend = async (c: SaaSCompany) => {
    const updatedStatus = c.status === "Suspended" ? "Active" : "Suspended";
    try {
      await mutations.updateStatus.mutateAsync({ id: c.id, status: updatedStatus });
      void logAction(
        updatedStatus === "Suspended" ? "Company Suspension" : "Company Activation",
        `Changed status of ${c.name} to ${updatedStatus}`,
      );
      toast(`Company status changed to ${updatedStatus}`, "info");
    } catch (err: any) {
      toast(err?.message || "Failed to update company status", "error");
    }
  };

  const handleImpersonation = async (c: SaaSCompany) => {
    try {
      const res = await authService.impersonate(c.companyId, c.name);
      if (res) {
        toast(`Opening Tenant HRMS session for ${c.name}...`, "success");
      }
    } catch (err: any) {
      toast(err?.message || "Impersonation failed", "error");
    }
  };

  const handleRenewalAction = async (companyId: string) => {
    try {
      await subscriptionMutations.renewSubscription.mutateAsync({
        id: companyId,
        duration: "1_YEAR",
      });
      void logAction(
        "Annual Subscription Renewal",
        `Renewed annual subscription for company ${companyId} for 1 calendar year`,
      );
      toast("Subscription successfully renewed for 1 year", "success");
    } catch (err: any) {
      toast(err?.message || "Failed to renew subscription", "error");
    }
  };

  const exportCompaniesReport = async () => {
    if (!filteredCompanies || filteredCompanies.length === 0) {
      toast("No company billing records available to export", "info");
      return;
    }
    try {
      const dataToExport = filteredCompanies.map((c) => ({
        "Company ID": c.id,
        "Company Name": c.name,
        "Plan Tier": c.plan,
        "Account Status": c.status,
        "Joined Date": c.joinedDate,
        "Expiry Date": c.expiryDate,
        "Owner Name": c.ownerName,
        "Owner Email": c.ownerEmail,
        "Purchased Seats": c.purchasedSeats,
        "Used Seats": c.usedSeats,
      }));
      await exportToExcel(dataToExport, "SaaS_Companies_Billing_Report.xlsx", "SaaS Companies");
      toast("Billing report exported as Excel File", "success");
    } catch (err: any) {
      toast(err?.message || "Failed to export billing report", "error");
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Action Bar & Primary Actions */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between bg-card p-4 rounded-2xl border border-border shadow-sm">
        <div ref={searchRef} className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search companies, owners, billing, emails..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
              setSearchOpen(true);
            }}
            onFocus={() => setSearchOpen(true)}
            className={inputCls + " pl-9"}
            autoComplete="off"
            name="searchQuery"
          />
          {searchOpen && searchQuery.trim() && (
            <div className="absolute left-0 right-0 top-11 rounded-xl border border-border bg-popover p-1 shadow-xl max-h-80 overflow-auto z-50">
              {filteredCompanies.length === 0 &&
                filteredInvoices.length === 0 &&
                filteredTickets.length === 0 && (
                  <div className="p-3 text-sm text-muted-foreground">
                    No matching results found.
                  </div>
                )}
              {filteredCompanies.slice(0, 3).map((c) => (
                <button
                  key={c.id}
                  onClick={() => {
                    setEditingCompany(c);
                    setSearchOpen(false);
                  }}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition hover:bg-muted"
                >
                  <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{c.name}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      Company • {c.plan} Plan • {c.ownerEmail}
                    </div>
                  </div>
                </button>
              ))}
              {filteredInvoices.slice(0, 3).map((i) => (
                <button
                  key={i.id}
                  onClick={() => {
                    setSearchOpen(false);
                    navigate({
                      to: "/super-admin/billing",
                      search: { invoiceId: i.id },
                    });
                  }}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition hover:bg-muted"
                >
                  <FileSpreadsheet className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">
                      {i.id} — {i.companyName || i.company}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      Invoice • ₹{i.amount} • {i.status}
                    </div>
                  </div>
                </button>
              ))}
              {filteredTickets.slice(0, 3).map((t) => (
                <button
                  key={t.id}
                  onClick={() => {
                    setSearchOpen(false);
                  }}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition hover:bg-muted"
                >
                  <MessageSquare className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{t.subject}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      Ticket • {t.companyName} • {t.status}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <Btn onClick={() => setActiveModal("add_company")} variant="primary" size="sm">
            <Plus className="h-4 w-4" /> Add Tenant
          </Btn>
          <Btn onClick={exportCompaniesReport} variant="outline" size="sm">
            <FileSpreadsheet className="h-4 w-4" /> Export Report
          </Btn>
        </div>
      </div>

      {/* KPI Cards */}
      <DashboardSummaryCards
        companiesCount={aggregatorStats?.companies?.total ?? companies.length}
        activeCompanies={aggregatorStats?.companies?.active ?? activeCompanies}
        trialCompanies={aggregatorStats?.companies?.trial ?? trialCompanies}
        expiredCompanies={
          aggregatorStats?.companies?.expired ??
          companies.filter((c) => c.status === "Expired" || c.status === "Suspended").length
        }
        totalEmployees={employees.length}
        onlineTodayCount={
          attendanceRecords.filter((a: any) => {
            const todayStr = getBusinessDateString();
            const isToday = a.date === todayStr || (a.date && String(a.date).startsWith(todayStr));
            return isToday && (a.status === "Present" || (a.checkIn && !a.checkOut));
          }).length
        }
        hrAdminsCount={companies.filter((c) => c.ownerName).length}
        mrr={mrr}
        openTickets={openTicketsValue}
        criticalTickets={criticalTicketsValue}
        systemUptime={systemUptimeValue}
        trialDays={systemSettings?.trialDays ?? 14}
        isLoading={isRevenueLoading}
        onOpenModal={(modal) => setActiveModal(modal)}
      />

      {/* Quick Actions Console */}
      <QuickActionsPanel
        onAddCompany={() => {
          setNewCompany({
            name: "",
            plan: "Basic",
            employeesCount: 15,
            status: "Active",
            ownerName: "",
            ownerEmail: "",
            purchasedSeats: 20,
          });
          setActiveModal("add_company");
        }}
        onCreateSub={() => setActiveModal("create_sub")}
        onAddStandardCompany={() => {
          setNewCompany({
            name: "",
            plan: "Standard",
            employeesCount: 10,
            status: "Active",
            ownerName: "",
            ownerEmail: "",
            purchasedSeats: 20,
          });
          setActiveModal("add_company");
        }}
        onGenInvoice={() => {
          setNewInvoice({ companyName: "", amount: 15000, status: "Paid" });
          setActiveModal("gen_invoice");
        }}
        onOpenTicket={() => {
          setNewTicket({ companyName: "", subject: "", priority: "High" });
          setActiveModal("open_ticket");
        }}
        onBroadcastAnno={() => {
          setNewAnnouncement({ type: "Maintenance", title: "", content: "" });
          setActiveModal("broadcast_anno");
        }}
        onManagePlans={() => setActiveModal("manage_plans")}
        onViewAudit={() => setActiveModal("view_audit")}
        onSysSettings={() => setActiveModal("sys_settings")}
      />

      {/* Charts Section */}
      <RevenueGrowthCharts
        mrr={mrr}
        arr={arr}
        isLoading={isRevenueLoading}
        invoices={invoices}
        renewalsDueAmount={renewalsDueAmount}
        revenueTrendPoints={revenueTrendPoints}
        momGrowthStr={momGrowthStr}
        activeCompanies={activeCompanies}
        companyGrowthBars={companyGrowthBars}
        companies={companies}
        seatMetrics={seatMetrics}
        empGrowthTrend={empGrowthTrend}
        subscriptionStats={subscriptionStats}
      />

      {/* Renewals & Announcements Row */}
      <RenewalsAndAnnouncements
        companies={companies}
        announcements={announcements}
        onRenewalAction={handleRenewalAction}
      />

      {/* Overview Tables */}
      <CompanyOverviewTable
        payrollStats={payrollStats}
        attendanceStats={attendanceStats}
        leaveStats={leaveStats}
        recruitmentStats={recruitmentStats}
        companies={companies}
        paginatedCompanies={paginatedCompanies}
        currentPage={currentPage}
        totalPages={totalPages}
        pageSize={pageSize}
        filteredCompaniesCount={filteredCompanies.length}
        onPageChange={(p) => setCurrentPage(p)}
        onEditCompany={(c) => setEditingCompany(c)}
        onToggleSuspend={handleToggleSuspend}
        onImpersonate={handleImpersonation}
        payments={filteredInvoices}
        planFilter={planFilter}
        statusFilter={statusFilter}
        onPlanFilterChange={(p) => {
          setPlanFilter(p);
          setCurrentPage(1);
        }}
        onStatusFilterChange={(s) => {
          setStatusFilter(s);
          setCurrentPage(1);
        }}
      />

      {/* Modals */}
      <OnboardCompanyModal
        isOpen={activeModal === "add_company"}
        onClose={() => setActiveModal(null)}
        onSubmit={handleAddCompany}
        newCompany={newCompany}
        setNewCompany={setNewCompany}
      />

      <EditCompanyModal
        editingCompany={editingCompany}
        setEditingCompany={setEditingCompany}
        onSubmit={handleEditCompany}
      />

      <CreateSubscriptionModal
        isOpen={activeModal === "create_sub"}
        onClose={() => setActiveModal(null)}
        companies={companies}
        plans={plans}
        onAssign={async ({ companyId, plan, seatCount }) => {
          try {
            await mutations.changePlan.mutateAsync({ id: companyId, plan });
            await mutations.editProfile.mutateAsync({
              id: companyId,
              data: { purchasedSeats: seatCount },
            });
            void logAction(
              "Assign Subscription",
              `Assigned ${plan} plan (${seatCount} seats) to tenant`,
            );
            toast("Subscription plan assigned successfully", "success");
            setActiveModal(null);
          } catch (err: any) {
            toast(err?.message || "Failed to assign subscription", "error");
          }
        }}
      />

      <GenerateInvoiceModal
        isOpen={activeModal === "gen_invoice"}
        onClose={() => setActiveModal(null)}
        companies={companies}
        newInvoice={newInvoice}
        setNewInvoice={setNewInvoice}
        onSubmit={handleAddInvoice}
      />

      <CreateTicketModal
        isOpen={activeModal === "open_ticket"}
        onClose={() => setActiveModal(null)}
        companies={companies}
        newTicket={newTicket}
        setNewTicket={setNewTicket}
        onSubmit={handleAddTicket}
      />

      <BroadcastAnnouncementModal
        isOpen={activeModal === "broadcast_anno"}
        onClose={() => setActiveModal(null)}
        newAnnouncement={newAnnouncement}
        setNewAnnouncement={setNewAnnouncement}
        onSubmit={handleAddAnnouncement}
      />

      <ManagePlansModal
        isOpen={activeModal === "manage_plans"}
        onClose={() => setActiveModal(null)}
        plans={plans}
        newPlan={newPlan}
        setNewPlan={setNewPlan}
        onSubmit={handleUpdatePricingPlan}
      />

      <ViewAuditLogsModal
        isOpen={activeModal === "view_audit"}
        onClose={() => setActiveModal(null)}
        auditLogs={auditLogs}
      />

      <SystemSettingsModal
        isOpen={activeModal === "sys_settings"}
        onClose={() => setActiveModal(null)}
        toast={toast}
      />
    </div>
  );
}

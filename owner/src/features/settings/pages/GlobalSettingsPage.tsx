import React, { useState, useEffect } from "react";
import {
  Save,
  Shield,
  Database,
  Mail,
  Bell,
  Key,
  ToggleLeft,
  ToggleRight,
  RefreshCw,
  CheckCircle2,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { systemService } from "../../../services/system.service";
import { systemSettingsService, GlobalSettings } from "../../../services/system-settings.service";
import { useQueryClient } from "@tanstack/react-query";
import {
  SYSTEM_SETTINGS_QUERY_KEY,
  SYSTEM_RUNTIME_SETTINGS_QUERY_KEY,
} from "../../../hooks/useSystemSettingsQuery";
import { useTranslation } from "react-i18next";
import { resolveLanguage } from "../../../i18n";

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

export function GlobalSettingsPage({ toast }: { toast?: any }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [settings, setSettings] = useState<GlobalSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSettings = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await systemSettingsService.getSettings();
      setSettings(data);
    } catch (err: any) {
      setError(err?.message || "Failed to load global platform settings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchSettings();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await systemSettingsService.updateSettings({
        ...settings,
        defaultLanguage: resolveLanguage(settings.defaultLanguage),
      });
      setSettings(updated);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: SYSTEM_SETTINGS_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: SYSTEM_RUNTIME_SETTINGS_QUERY_KEY }),
      ]);
      if (toast) toast(t("settings.saveSuccess"), "success");
    } catch (err: any) {
      const msg = err?.message || t("settings.saveError");
      setError(msg);
      if (toast) toast(msg, "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm font-medium text-muted-foreground">
            {t("auth.loading")}
          </p>
        </div>
      </div>
    );
  }

  if (error && !settings) {
    return (
      <div className="space-y-6 w-full max-w-4xl mx-auto min-w-0">
        <PageHeader
          title={t("settings.title")}
          subtitle={t("settings.subtitle")}
        />
        <div className={cardCls + " p-6 text-center"}>
          <AlertCircle className="w-10 h-10 mx-auto text-destructive mb-2" />
          <p className="text-sm font-medium text-destructive mb-4">{error}</p>
          <button onClick={fetchSettings} className={btnCls}>
            <RefreshCw className="w-4 h-4" /> Retry Loading
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full max-w-4xl mx-auto min-w-0 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <PageHeader
        title={t("settings.title")}
        subtitle={t("settings.subtitle")}
        action={
          <button
            onClick={fetchSettings}
            disabled={loading || saving}
            className={btnCls + " !bg-secondary !text-secondary-foreground"}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
        }
      />

      {error && (
        <div className="flex items-center gap-2 p-3.5 rounded-xl border border-destructive/30 bg-destructive/10 text-destructive text-xs font-medium">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className={cardCls}>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">
                {t("settings.timeZone")}
              </label>
              <select
                value={settings?.timeZone || "IST (Indian Standard Time)"}
                onChange={(e) => setSettings((s) => (s ? { ...s, timeZone: e.target.value } : s))}
                className={inputCls}
              >
                <option value="UTC (Coordinated Universal Time)">
                  UTC (Coordinated Universal Time)
                </option>
                <option value="IST (Indian Standard Time)">IST (Indian Standard Time)</option>
                <option value="EST (Eastern Standard Time)">EST (Eastern Standard Time)</option>
                <option value="PST (Pacific Standard Time)">PST (Pacific Standard Time)</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">
                {t("settings.currency")}
              </label>
              <select
                value={settings?.currency || "INR (₹)"}
                onChange={(e) => setSettings((s) => (s ? { ...s, currency: e.target.value } : s))}
                className={inputCls}
              >
                <option value="INR (₹)">INR (₹)</option>
                <option value="USD ($)">USD ($)</option>
                <option value="EUR (€)">EUR (€)</option>
                <option value="GBP (£)">GBP (£)</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">
                {t("settings.dateFormat")}
              </label>
              <select
                value={settings?.dateFormat || "YYYY-MM-DD"}
                onChange={(e) => setSettings((s) => (s ? { ...s, dateFormat: e.target.value } : s))}
                className={inputCls}
              >
                <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                <option value="MM/DD/YYYY">MM/DD/YYYY</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">
                {t("settings.defaultLanguage")}
              </label>
              <select
                value={resolveLanguage(settings?.defaultLanguage)}
                onChange={(e) =>
                  setSettings((s) => (s ? { ...s, defaultLanguage: e.target.value } : s))
                }
                className={inputCls}
              >
                <option value="en">English (en)</option>
                <option value="hi">Hindi (hi) — हिन्दी</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">
                {t("settings.sessionTimeout")}
              </label>
              <input
                type="number"
                min="5"
                max="1440"
                value={settings?.sessionTimeoutMins ?? 30}
                onChange={(e) =>
                  setSettings((s) =>
                    s ? { ...s, sessionTimeoutMins: parseInt(e.target.value) || 30 } : s,
                  )
                }
                className={inputCls}
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">
                {t("settings.trialDays")}
              </label>
              <input
                type="number"
                min="1"
                max="365"
                value={settings?.trialDays ?? 14}
                onChange={(e) =>
                  setSettings((s) => (s ? { ...s, trialDays: parseInt(e.target.value) || 14 } : s))
                }
                className={inputCls}
              />
            </div>
          </div>

          <div className="border-t border-border pt-4 space-y-3">
            <label className="flex items-center gap-3 text-xs cursor-pointer hover:bg-muted/30 p-2 rounded w-max">
              <input
                type="checkbox"
                checked={settings?.strictPasswordPolicy ?? true}
                onChange={(e) =>
                  setSettings((s) => (s ? { ...s, strictPasswordPolicy: e.target.checked } : s))
                }
                className="rounded border-input text-primary focus:ring-primary h-4 w-4"
              />
              <span className="font-medium">{t("settings.strictPasswordPolicy")}</span>
            </label>

            <label className="flex items-center gap-3 text-xs cursor-pointer hover:bg-muted/30 p-2 rounded w-max">
              <input
                type="checkbox"
                checked={settings?.requireOtpLogin ?? true}
                onChange={(e) =>
                  setSettings((s) => (s ? { ...s, requireOtpLogin: e.target.checked } : s))
                }
                className="rounded border-input text-primary focus:ring-primary h-4 w-4"
              />
              <span className="font-medium">{t("settings.requireOtpLogin")}</span>
            </label>

            <label className="flex items-center gap-3 text-xs cursor-pointer hover:bg-muted/30 p-2 rounded w-max">
              <input
                type="checkbox"
                checked={settings?.requireCompanyApproval ?? false}
                onChange={(e) =>
                  setSettings((s) => (s ? { ...s, requireCompanyApproval: e.target.checked } : s))
                }
                className="rounded border-input text-primary focus:ring-primary h-4 w-4"
              />
              <span className="font-medium">{t("settings.requireCompanyApproval")}</span>
            </label>

            <label className="flex items-center gap-3 text-xs cursor-pointer hover:bg-muted/30 p-2 rounded w-max">
              <input
                type="checkbox"
                checked={settings?.maintenanceMode ?? false}
                onChange={(e) =>
                  setSettings((s) => (s ? { ...s, maintenanceMode: e.target.checked } : s))
                }
                className="rounded border-input text-primary focus:ring-primary h-4 w-4"
              />
              <span className="text-destructive font-bold">
                {t("settings.maintenanceMode")}
              </span>
            </label>
          </div>

          <div className="flex justify-end pt-2 border-t border-border">
            <button type="submit" disabled={saving} className={btnCls + " min-w-[140px]"}>
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> {t("common.saving")}
                </>
              ) : (
                t("common.saveChanges")
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function formatHeader(key: string): string {
  const dictionary: Record<string, string> = {
    companyId: "Company ID",
    companyName: "Company Name",
    plan: "Subscription Plan",
    cycle: "Billing Cycle",
    status: "Status",
    ownerName: "Owner Name",
    ownerEmail: "Owner Email",
    employeesCount: "Employee Count",
    storageUsed: "Storage Used",
    createdAt: "Created Date",
    subscriptionId: "Subscription ID",
    billingCycle: "Billing Cycle",
    amount: "Amount (INR)",
    startDate: "Start Date",
    expiryDate: "Expiry Date",
    autoRenew: "Auto Renew",
    employeeId: "Employee ID",
    name: "Full Name",
    email: "Email Address",
    company: "Company Name",
    department: "Department",
    designation: "Designation",
    joinedDate: "Joined Date",
    monthlySalary: "Monthly Salary (INR)",
    location: "Office Location",
    userId: "User ID",
    role: "Assigned Role",
    type: "Type",
    date: "Date",
    tax: "Tax",
    period: "Billing Period",
    invoiceId: "Invoice ID",
    issueDate: "Issue Date",
    couponCode: "Coupon Code",
    payrollId: "Payroll ID",
    employeeName: "Employee Name",
    month: "Month",
    payDate: "Pay Date",
    basicSalary: "Basic Salary (INR)",
    netSalary: "Net Salary (INR)",
    recordId: "Record ID",
    inTime: "Clock In Time",
    outTime: "Clock Out Time",
    remarks: "Remarks",
    requestId: "Request ID",
    leaveType: "Leave Type",
    fromDate: "From Date",
    toDate: "To Date",
    days: "Days Count",
    candidateId: "Candidate ID",
    jobTitle: "Job Title",
    stage: "Pipeline Stage",
    appliedDate: "Applied Date",
    storageAllocation: "Storage Allocation",
    logId: "Log ID",
    userName: "User Name",
    action: "Action Taken",
    details: "Audit Details",
    timestamp: "Timestamp",
    notificationId: "Notification ID",
    title: "Notification Title",
    severity: "Severity Level",
    category: "Category",
    metric: "System Metric",
    value: "Current Value",
  };

  if (dictionary[key]) return dictionary[key];

  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/_/g, " ")
    .replace(/^./, (str) => str.toUpperCase())
    .trim();
}

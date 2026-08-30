import React, { useState, useEffect } from "react";
import {
  XCircle,
  ToggleLeft,
  ToggleRight,
  Globe,
  Clock,
  DollarSign,
  Calendar,
  ShieldCheck,
  KeyRound,
  Building2,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  systemSettingsService,
  GlobalSettings,
} from "../../../../services/system-settings.service";
import {
  useSystemSettingsQuery,
  SYSTEM_SETTINGS_QUERY_KEY,
  SYSTEM_RUNTIME_SETTINGS_QUERY_KEY,
} from "../../../../hooks/useSystemSettingsQuery";
import { resolveLanguage } from "../../../../i18n";

const inputCls =
  "h-9 w-full rounded-lg border border-input bg-background px-3 text-xs outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20";

function Btn({
  children,
  onClick,
  variant = "primary",
  type = "button",
  disabled = false,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "outline";
  type?: "button" | "submit";
  disabled?: boolean;
}) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition duration-200 px-4 py-2 text-xs disabled:opacity-50 disabled:cursor-not-allowed";
  const variants = {
    primary: "btn-gradient hover:brightness-110 text-white",
    outline:
      "border border-border bg-card hover:border-primary hover:text-primary text-foreground",
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${variants[variant]}`}
    >
      {children}
    </button>
  );
}

function Field({
  label,
  icon: Icon,
  children,
}: {
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
        {Icon && <Icon className="h-3.5 w-3.5 text-primary" />}
        {label}
      </label>
      {children}
    </div>
  );
}

function LocalModalShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/60 p-3 sm:p-4 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl max-h-[90vh] flex flex-col rounded-2xl border border-border bg-card shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden"
      >
        <div className="flex items-center justify-between border-b border-border px-5 sm:px-6 py-4 shrink-0">
          <div className="text-base sm:text-lg font-bold flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" />
            {title}
          </div>
          <button
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted transition"
          >
            <XCircle className="h-4 w-4" />
          </button>
        </div>
        <div className="p-4 sm:p-6 overflow-y-auto flex-1">{children}</div>
      </div>
    </div>
  );
}

interface SystemSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  toast?: (message: string, tone?: "success" | "error" | "info") => void;
}

export const SystemSettingsModal: React.FC<SystemSettingsModalProps> = ({
  isOpen,
  onClose,
  toast,
}) => {
  const queryClient = useQueryClient();
  const { data: serverSettings, isLoading, isError } = useSystemSettingsQuery();

  const [form, setForm] = useState<GlobalSettings>({
    timeZone: "IST (Indian Standard Time)",
    currency: "INR (₹)",
    dateFormat: "YYYY-MM-DD",
    defaultLanguage: "en",
    sessionTimeoutMins: 30,
    trialDays: 14,
    strictPasswordPolicy: true,
    requireOtpLogin: true,
    requireCompanyApproval: false,
    maintenanceMode: false,
  });

  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Synchronize local form state with authoritative server data whenever modal opens or data updates
  useEffect(() => {
    if (serverSettings) {
      setForm(serverSettings);
    }
  }, [serverSettings, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrorMsg(null);

    const payload: Partial<GlobalSettings> = {
      ...form,
      defaultLanguage: resolveLanguage(form.defaultLanguage),
      sessionTimeoutMins: Number(form.sessionTimeoutMins),
      trialDays: Number(form.trialDays),
    };

    try {
      await systemSettingsService.updateSettings(payload);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: SYSTEM_SETTINGS_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: SYSTEM_RUNTIME_SETTINGS_QUERY_KEY }),
      ]);
      if (toast) {
        toast("Platform settings saved successfully", "success");
      }
      onClose();
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        "Failed to update platform settings. Please check your permissions.";
      setErrorMsg(msg);
      if (toast) {
        toast(msg, "error");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <LocalModalShell title="System Platform Settings" onClose={onClose}>
      {isLoading ? (
        <div className="flex h-48 items-center justify-center">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <span className="text-xs text-muted-foreground">Loading authoritative settings...</span>
          </div>
        </div>
      ) : isError && !serverSettings ? (
        <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs space-y-2">
          <div className="font-bold flex items-center gap-2">
            <AlertCircle className="h-4 w-4" /> Failed to load system settings
          </div>
          <p>Please check your connection and SuperAdmin authorization.</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5 text-xs">
          {errorMsg && (
            <div className="p-3 rounded-lg bg-destructive/15 border border-destructive/30 text-destructive text-xs flex items-start gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Group 1: Localization & Formatting */}
          <div className="space-y-3">
            <div className="text-xs font-bold text-foreground border-b border-border pb-1">
              Localization & Display
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Default Timezone" icon={Clock}>
                <select
                  value={form.timeZone}
                  onChange={(e) => setForm({ ...form, timeZone: e.target.value })}
                  className={inputCls}
                >
                  <option value="IST (Indian Standard Time)">IST (Indian Standard Time)</option>
                  <option value="UTC (Coordinated Universal Time)">UTC (Coordinated Universal Time)</option>
                  <option value="EST (Eastern Standard Time)">EST (Eastern Standard Time)</option>
                  <option value="PST (Pacific Standard Time)">PST (Pacific Standard Time)</option>
                  <option value="Europe/London">Europe/London (GMT)</option>
                  <option value="Asia/Dubai">Asia/Dubai (GST)</option>
                </select>
              </Field>

              <Field label="System Currency" icon={DollarSign}>
                <select
                  value={form.currency}
                  onChange={(e) => setForm({ ...form, currency: e.target.value })}
                  className={inputCls}
                >
                  <option value="INR (₹)">INR (₹) - Indian Rupee</option>
                  <option value="USD ($)">USD ($) - US Dollar</option>
                  <option value="EUR (€)">EUR (€) - Euro</option>
                  <option value="GBP (£)">GBP (£) - British Pound</option>
                  <option value="AED (AED)">AED (AED) - UAE Dirham</option>
                </select>
              </Field>

              <Field label="Date Format" icon={Calendar}>
                <select
                  value={form.dateFormat}
                  onChange={(e) => setForm({ ...form, dateFormat: e.target.value })}
                  className={inputCls}
                >
                  <option value="YYYY-MM-DD">YYYY-MM-DD (2026-08-11)</option>
                  <option value="DD/MM/YYYY">DD/MM/YYYY (11/08/2026)</option>
                  <option value="MM/DD/YYYY">MM/DD/YYYY (08/11/2026)</option>
                </select>
              </Field>

              <Field label="Default Language" icon={Globe}>
                <select
                  value={form.defaultLanguage}
                  onChange={(e) => setForm({ ...form, defaultLanguage: e.target.value })}
                  className={inputCls}
                >
                  <option value="en">English (en)</option>
                  <option value="hi">हिंदी (hi)</option>
                </select>
              </Field>
            </div>
          </div>

          {/* Group 2: Operational Timeouts & Limits */}
          <div className="space-y-3">
            <div className="text-xs font-bold text-foreground border-b border-border pb-1">
              Operational Timeouts & Trials
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Session Timeout (Minutes)" icon={Clock}>
                <input
                  type="number"
                  min={5}
                  max={10080}
                  value={form.sessionTimeoutMins}
                  onChange={(e) =>
                    setForm({ ...form, sessionTimeoutMins: Math.max(1, Number(e.target.value)) })
                  }
                  className={inputCls}
                  required
                />
              </Field>

              <Field label="Default Trial Duration (Days)" icon={Calendar}>
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={form.trialDays}
                  onChange={(e) =>
                    setForm({ ...form, trialDays: Math.max(1, Number(e.target.value)) })
                  }
                  className={inputCls}
                  required
                />
              </Field>
            </div>
          </div>

          {/* Group 3: Security & Governance Toggles */}
          <div className="space-y-3">
            <div className="text-xs font-bold text-foreground border-b border-border pb-1">
              Security, Governance & Maintenance
            </div>

            <div className="space-y-2.5">
              {/* Strict Password Policy */}
              <div className="flex items-center justify-between p-2.5 rounded-xl border border-border bg-background hover:border-primary/40 transition">
                <div className="space-y-0.5 pr-2">
                  <div className="font-bold text-foreground flex items-center gap-1.5">
                    <ShieldCheck className="h-3.5 w-3.5 text-primary" /> Strict Password Policy
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    Enforces 8+ chars, uppercase, lowercase, numbers, and symbols across registration & resets.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setForm({ ...form, strictPasswordPolicy: !form.strictPasswordPolicy })
                  }
                  className="text-primary transition shrink-0"
                >
                  {form.strictPasswordPolicy ? (
                    <ToggleRight className="h-7 w-7 text-primary" />
                  ) : (
                    <ToggleLeft className="h-7 w-7 text-muted-foreground" />
                  )}
                </button>
              </div>

              {/* Require OTP Login */}
              <div className="flex items-center justify-between p-2.5 rounded-xl border border-border bg-background hover:border-primary/40 transition">
                <div className="space-y-0.5 pr-2">
                  <div className="font-bold text-foreground flex items-center gap-1.5">
                    <KeyRound className="h-3.5 w-3.5 text-amber-500" /> Require OTP for Login (2FA)
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    Requires 6-digit email OTP challenge verification before issuing authentication tokens.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, requireOtpLogin: !form.requireOtpLogin })}
                  className="text-primary transition shrink-0"
                >
                  {form.requireOtpLogin ? (
                    <ToggleRight className="h-7 w-7 text-primary" />
                  ) : (
                    <ToggleLeft className="h-7 w-7 text-muted-foreground" />
                  )}
                </button>
              </div>

              {/* Require Company Approval */}
              <div className="flex items-center justify-between p-2.5 rounded-xl border border-border bg-background hover:border-primary/40 transition">
                <div className="space-y-0.5 pr-2">
                  <div className="font-bold text-foreground flex items-center gap-1.5">
                    <Building2 className="h-3.5 w-3.5 text-indigo-500" /> Require Company Approval
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    New tenant registrations remain in Pending state until explicitly approved by SuperAdmin.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setForm({ ...form, requireCompanyApproval: !form.requireCompanyApproval })
                  }
                  className="text-primary transition shrink-0"
                >
                  {form.requireCompanyApproval ? (
                    <ToggleRight className="h-7 w-7 text-primary" />
                  ) : (
                    <ToggleLeft className="h-7 w-7 text-muted-foreground" />
                  )}
                </button>
              </div>

              {/* Global Maintenance Mode */}
              <div className="flex items-center justify-between p-2.5 rounded-xl border border-amber-500/30 bg-amber-500/5 hover:border-amber-500/50 transition">
                <div className="space-y-0.5 pr-2">
                  <div className="font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" /> Global Maintenance Mode
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    Blocks tenant traffic with HTTP 503 while preserving SuperAdmin management access.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, maintenanceMode: !form.maintenanceMode })}
                  className="text-amber-600 transition shrink-0"
                >
                  {form.maintenanceMode ? (
                    <ToggleRight className="h-7 w-7 text-amber-600 dark:text-amber-400" />
                  ) : (
                    <ToggleLeft className="h-7 w-7 text-muted-foreground" />
                  )}
                </button>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-border">
            <Btn onClick={onClose} variant="outline" disabled={saving}>
              Cancel
            </Btn>
            <Btn type="submit" variant="primary" disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving Settings...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5" /> Save Settings
                </>
              )}
            </Btn>
          </div>
        </form>
      )}
    </LocalModalShell>
  );
};

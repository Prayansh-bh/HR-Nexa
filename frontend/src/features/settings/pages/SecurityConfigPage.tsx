import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  Building2,
  Users,
  CreditCard,
  ShieldAlert,
  Cpu,
  FileClock,
  Activity,
  BarChart3,
  CalendarCheck,
  CalendarDays,
  Wallet,
  FileText,
  CheckCircle2,
  XCircle,
  Clock,
  Upload,
  Trash2,
  Edit3,
  Eye,
  Download,
  Plus,
  Search,
  Filter,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Send,
  Lock,
  Sparkles,
  MapPin,
  Check,
  ChevronRight,
  CalendarPlus,
  FileCheck,
  Layers,
  FileSpreadsheet,
  KanbanSquare,
  UserCheck,
  Briefcase,
  Mail,
  MessageSquare,
  ShieldCheck,
  HelpCircle,
  Inbox,
  PieChart,
  Sliders,
  ToggleLeft,
  ToggleRight,
  ArrowRight,
  UserPlus,
  Info,
  Pen,
  Loader2,
  Server,
  AlertTriangle,
  RotateCcw,
  Shield,
} from "lucide-react";
import type { Broadcast, AuthUser } from "../../../types";
import { subscriptionService } from "../../../services/subscription.service";
import { billingService, Invoice } from "../../../services/billing.service";
import { backupService, BackupRecord } from "../../../services/backup.service";
import { downloadInvoiceHtml } from "../../../utils/invoiceDownloader";
import {
  useAuditLogsStore,
  useEmployeesStore,
  useMessagingStore,
  useRecruitmentStore,
} from "../../../store";
import { attendanceService } from "../../../services/attendance.service";
import { ticketsService, SupportTicket } from "../../../services/tickets.service";
import axiosInstance from "../../../api/axios";
import { authService } from "../../../services/auth.service";
import { employeeService } from "../../../services/employee.service";
import { ExitListPage } from "../../exit/pages/ExitListPage";
import { RolePermissionMatrixTable } from "../../settings/components/RolePermissionMatrixTable";
import { usePerformanceQuery, usePerformanceMutations } from "../../../hooks/usePerformanceQuery";
import {
  useDocumentsQuery,
  useDeleteDocumentMutation,
  useUploadDocumentMutation,
} from "../../../hooks/useDocumentsQuery";
import { ModalShell } from "../../../components/ui";

const inputCls =
  "h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20";
const cardCls =
  "rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)] transition hover:shadow-[var(--shadow-elevated)]";

function Field({
  label,
  children,
  className = "",
  error,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
  error?: string;
}) {
  return (
    <div className={className}>
      <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">{label}</label>
      {children}
      {error && <div className="mt-1 text-xs text-destructive">{error}</div>}
    </div>
  );
}

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
    primary: "btn-gradient hover:brightness-110",
    success: "bg-[color:var(--color-success)] text-white shadow-md hover:brightness-110",
    ghost: "text-muted-foreground hover:bg-muted hover:text-foreground",
    outline: "border border-border bg-card hover:border-primary hover:text-primary",
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

function Badge({ children, tone = "slate" }: { children: React.ReactNode; tone?: string }) {
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
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${tones[tone] || tones.slate}`}
    >
      {children}
    </span>
  );
}

import {
  useSessionsQuery,
  useRevokeSessionMutation,
  useRevokeOtherSessionsMutation,
  useChangePasswordMutation,
} from "../../../hooks/useSessionsQuery";

export function SecurityConfigPage({ toast }: { toast: (m: string) => void }) {
  const [sso, setSso] = useState(true);
  const [tfa, setTfa] = useState(true);
  const [form, setForm] = useState({ timeout: 30, ip: "192.168.1.1/24\n10.0.0.1/16" });

  // Change Password state
  const [passwords, setPasswords] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const changePasswordMutation = useChangePasswordMutation();

  // Password validation rules helper
  const passwordCriteria = useMemo(() => {
    const p = passwords.newPassword;
    return {
      minLength: p.length >= 8,
      hasUpper: /[A-Z]/.test(p),
      hasLower: /[a-z]/.test(p),
      hasNumber: /[0-9]/.test(p),
      hasSpecial: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(p),
      matchesConfirm: Boolean(p && passwords.confirmPassword && p === passwords.confirmPassword),
    };
  }, [passwords.newPassword, passwords.confirmPassword]);

  const isPasswordPolicyValid = useMemo(() => {
    return (
      passwordCriteria.minLength &&
      passwordCriteria.hasUpper &&
      passwordCriteria.hasLower &&
      passwordCriteria.hasNumber &&
      passwordCriteria.hasSpecial
    );
  }, [passwordCriteria]);

  // Active Sessions state
  const { data: sessions = [], isLoading: isLoadingSessions } = useSessionsQuery();
  const revokeSessionMutation = useRevokeSessionMutation();
  const revokeOtherSessionsMutation = useRevokeOtherSessionsMutation();

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);

    if (!passwords.currentPassword) {
      setPasswordError("Please enter your current password.");
      return;
    }
    if (!passwordCriteria.minLength) {
      setPasswordError("Password must be at least 8 characters long.");
      return;
    }
    if (!passwordCriteria.hasUpper) {
      setPasswordError("Password must include at least one uppercase letter (A-Z).");
      return;
    }
    if (!passwordCriteria.hasLower) {
      setPasswordError("Password must include at least one lowercase letter (a-z).");
      return;
    }
    if (!passwordCriteria.hasNumber) {
      setPasswordError("Password must include at least one numeric digit (0-9).");
      return;
    }
    if (!passwordCriteria.hasSpecial) {
      setPasswordError("Password must include at least one special character (e.g. !@#$%^&*).");
      return;
    }
    if (passwords.newPassword !== passwords.confirmPassword) {
      setPasswordError("New password and confirmation password do not match.");
      return;
    }

    try {
      await changePasswordMutation.mutateAsync({
        currentPassword: passwords.currentPassword,
        newPassword: passwords.newPassword,
      });
      setPasswordSuccess("Password updated successfully!");
      toast("Password updated successfully!");
      setPasswords({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch (err: any) {
      const errMsg = err?.response?.data?.message || err?.message || "Failed to update password. Please check your credentials.";
      setPasswordError(errMsg);
      toast(`Failed to change password: ${errMsg}`);
    }
  };

  const handleRevokeSession = async (id: string) => {
    try {
      await revokeSessionMutation.mutateAsync(id);
      toast("Session revoked successfully.");
    } catch (err: any) {
      toast(`Failed to revoke session: ${err?.message || "Error"}`);
    }
  };

  const handleRevokeOtherSessions = async () => {
    try {
      await revokeOtherSessionsMutation.mutateAsync();
      toast("All other active sessions revoked.");
    } catch (err: any) {
      toast(`Failed to revoke sessions: ${err?.message || "Error"}`);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Security Settings</h1>
        <p className="text-sm text-muted-foreground">
          Enforce authentication structures, session timings, active devices, and IP allowlists.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className={cardCls + " md:col-span-2 space-y-6"}>
          <div className="flex justify-between items-center pb-4 border-b border-border">
            <div>
              <h3 className="font-bold">SSO Authentication</h3>
              <p className="text-xs text-muted-foreground">
                Single-sign on federation via Okta, AzureAD, or OIDC.
              </p>
            </div>
            <Badge tone="indigo">Enterprise IDP Managed</Badge>
          </div>

          <div className="flex justify-between items-center pb-4 border-b border-border">
            <div>
              <h3 className="font-bold">2FA / MFA Enforcement</h3>
              <p className="text-xs text-muted-foreground">
                Time-based authenticator passcode challenge for tenant logins.
              </p>
            </div>
            <Badge tone="green">Enforced via Policy</Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Session Token Expiry">
              <input
                disabled
                value="15 Minutes (Rolling Refresh)"
                className={inputCls + " bg-muted cursor-not-allowed"}
              />
            </Field>
            <Field label="Password Rules Complexity">
              <input
                disabled
                value="High (8+ Chars, Upper, Lower, Number, Spec)"
                className={inputCls + " bg-muted cursor-not-allowed"}
              />
            </Field>
          </div>
        </div>

        <div className={cardCls + " space-y-4"}>
          <h3 className="font-bold">Network & IP Policy</h3>
          <p className="text-xs text-muted-foreground">
            Access filtering is managed at the platform ingress and reverse proxy layer.
          </p>
          <div className="p-3 bg-muted/40 rounded-xl border border-border text-xs space-y-2">
            <div className="flex justify-between font-mono">
              <span className="text-muted-foreground">Ingress Gateway:</span>
              <span className="font-bold">Active</span>
            </div>
            <div className="flex justify-between font-mono">
              <span className="text-muted-foreground">Subnet Scope:</span>
              <span className="font-bold">Platform VPC</span>
            </div>
            <div className="flex justify-between font-mono">
              <span className="text-muted-foreground">Rate Limiting:</span>
              <span className="text-emerald-500 font-bold">Enabled</span>
            </div>
          </div>
        </div>
      </div>

      {/* Change Password Card */}
      <div className={cardCls + " space-y-4"}>
        <div className="flex items-center gap-2 border-b border-border pb-3">
          <Lock className="h-5 w-5 text-primary" />
          <div>
            <h3 className="font-bold text-base">Change Account Password</h3>
            <p className="text-xs text-muted-foreground">Update your authentication password credentials securely.</p>
          </div>
        </div>

        {passwordError && (
          <div className="flex items-center gap-2 p-3 rounded-xl border border-destructive/20 bg-destructive/10 text-xs text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{passwordError}</span>
          </div>
        )}

        {passwordSuccess && (
          <div className="flex items-center gap-2 p-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-xs text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{passwordSuccess}</span>
          </div>
        )}

        <form onSubmit={handleChangePassword} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Field label="Current Password">
              <input
                type="password"
                placeholder="••••••••"
                value={passwords.currentPassword}
                onChange={(e) => {
                  setPasswords({ ...passwords, currentPassword: e.target.value });
                  setPasswordError(null);
                }}
                className={inputCls}
                required
              />
            </Field>
            <Field label="New Password">
              <input
                type="password"
                placeholder="Minimum 8 characters"
                value={passwords.newPassword}
                onChange={(e) => {
                  setPasswords({ ...passwords, newPassword: e.target.value });
                  setPasswordError(null);
                }}
                className={inputCls}
                required
              />
            </Field>
            <Field label="Confirm New Password">
              <input
                type="password"
                placeholder="Confirm new password"
                value={passwords.confirmPassword}
                onChange={(e) => {
                  setPasswords({ ...passwords, confirmPassword: e.target.value });
                  setPasswordError(null);
                }}
                className={inputCls}
                required
              />
            </Field>
          </div>

          {/* Real-time Password Policy Checklist */}
          {passwords.newPassword && (
            <div className="p-3.5 rounded-xl bg-muted/40 border border-border space-y-2">
              <span className="text-xs font-semibold text-foreground">Password Requirements:</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                <div className={`flex items-center gap-1.5 ${passwordCriteria.minLength ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`}>
                  {passwordCriteria.minLength ? <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" /> : <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 mx-1" />}
                  <span>At least 8 characters</span>
                </div>
                <div className={`flex items-center gap-1.5 ${passwordCriteria.hasUpper ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`}>
                  {passwordCriteria.hasUpper ? <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" /> : <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 mx-1" />}
                  <span>At least 1 uppercase (A-Z)</span>
                </div>
                <div className={`flex items-center gap-1.5 ${passwordCriteria.hasLower ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`}>
                  {passwordCriteria.hasLower ? <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" /> : <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 mx-1" />}
                  <span>At least 1 lowercase (a-z)</span>
                </div>
                <div className={`flex items-center gap-1.5 ${passwordCriteria.hasNumber ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`}>
                  {passwordCriteria.hasNumber ? <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" /> : <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 mx-1" />}
                  <span>At least 1 number (0-9)</span>
                </div>
                <div className={`flex items-center gap-1.5 ${passwordCriteria.hasSpecial ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`}>
                  {passwordCriteria.hasSpecial ? <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" /> : <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 mx-1" />}
                  <span>At least 1 special char (!@#$%)</span>
                </div>
                {passwords.confirmPassword && (
                  <div className={`flex items-center gap-1.5 ${passwordCriteria.matchesConfirm ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}`}>
                    {passwordCriteria.matchesConfirm ? <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" /> : <div className="h-1.5 w-1.5 rounded-full bg-destructive mx-1" />}
                    <span>Passwords match</span>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="flex justify-end pt-1">
            <Btn type="submit" disabled={changePasswordMutation.isPending || !isPasswordPolicyValid}>
              {changePasswordMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Update Password"}
            </Btn>
          </div>
        </form>
      </div>

      {/* Active User Sessions & Devices Table */}
      <div className={cardCls + " space-y-4"}>
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <Server className="h-5 w-5 text-primary" />
            <div>
              <h3 className="font-bold text-base">Active Login Sessions</h3>
              <p className="text-xs text-muted-foreground">Manage active device connections and browser sessions.</p>
            </div>
          </div>
          <Btn variant="danger" size="sm" onClick={handleRevokeOtherSessions} disabled={revokeOtherSessionsMutation.isPending}>
            {revokeOtherSessionsMutation.isPending ? "Revoking..." : "Logout All Other Devices"}
          </Btn>
        </div>

        {isLoadingSessions ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : sessions.length === 0 ? (
          <div className="py-6 text-center text-xs text-muted-foreground">
            No active session records found or running in single-device mode.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border text-muted-foreground uppercase">
                <tr>
                  <th className="py-2 px-3">Device / Browser</th>
                  <th className="py-2 px-3">IP Address</th>
                  <th className="py-2 px-3">Status</th>
                  <th className="py-2 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sessions.map((s: any) => (
                  <tr key={s.id}>
                    <td className="py-2.5 px-3 font-semibold">{s.userAgent || s.device || "Browser Session"}</td>
                    <td className="py-2.5 px-3 font-mono">{s.ipAddress || "127.0.0.1"}</td>
                    <td className="py-2.5 px-3">
                      {s.isCurrent ? <Badge tone="green">Current Device</Badge> : <Badge tone="slate">Active</Badge>}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      {!s.isCurrent && (
                        <Btn variant="ghost" size="sm" onClick={() => handleRevokeSession(s.id)}>
                          Revoke
                        </Btn>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

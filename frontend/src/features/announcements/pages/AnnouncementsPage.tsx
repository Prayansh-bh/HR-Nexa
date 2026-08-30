import React, { useState, useMemo, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
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
import { hasPermission } from "../../../auth/authorization";
import { PERMISSIONS } from "../../../auth/permissions";

import { formatDateTime } from "../../../utils/date.utils";

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

function getCategoryBadgeConfig(rawType?: string) {
  const typeLower = (rawType || "Notice").toLowerCase();
  if (typeLower.includes("security")) {
    return {
      tone: "rose",
      label: "Security Advisory",
      icon: <ShieldAlert size={12} className="shrink-0" />,
    };
  }
  if (typeLower.includes("maintenance")) {
    return {
      tone: "amber",
      label: "Platform Maintenance",
      icon: <AlertTriangle size={12} className="shrink-0" />,
    };
  }
  if (typeLower.includes("release")) {
    return {
      tone: "green",
      label: "Release Updates",
      icon: <Sparkles size={12} className="shrink-0" />,
    };
  }
  return {
    tone: "sky",
    label: rawType || "General Notice",
    icon: <MessageSquare size={12} className="shrink-0" />,
  };
}

export function AnnouncementsPage({
  toast,
  broadcasts,
  setBroadcasts,
  user,
}: {
  toast: (m: string) => void;
  broadcasts: Broadcast[];
  setBroadcasts: (b: Broadcast[] | ((p: Broadcast[]) => Broadcast[])) => void;
  user: any;
}) {
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({
    t: "",
    d: "",
    type: "Notice",
    scheduledFor: "",
    duration: "2 Hours",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const queryClient = useQueryClient();

  const fetchAnnouncements = useMessagingStore((s) => s.fetchAnnouncements);
  const createAnnouncement = useMessagingStore((s) => s.createAnnouncement);

  const canCreate =
    user?.role === "SuperAdmin" ||
    user?.role === "CompanyOwner" ||
    user?.role === "HRAdmin" ||
    hasPermission(user, PERMISSIONS.SYSTEM_ANNOUNCEMENT_CREATE) ||
    hasPermission(user, "system:announcement:create");

  useEffect(() => {
    fetchAnnouncements();
  }, [fetchAnnouncements]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        fetchAnnouncements(),
        queryClient.invalidateQueries({ queryKey: ["announcements"] }),
      ]);
      toast("System announcements refreshed");
    } catch {
      toast("Failed to refresh announcements");
    } finally {
      setIsRefreshing(false);
    }
  };

  const add = async () => {
    if (!form.t || !form.d) return;
    setIsSubmitting(true);
    try {
      await createAnnouncement({
        title: form.t,
        content: form.d,
        type: form.type,
        scheduledFor: form.scheduledFor || undefined,
        duration: form.type === "Maintenance" ? form.duration : undefined,
      });
      await queryClient.invalidateQueries({ queryKey: ["announcements"] });
      toast("Announcement broadcast sent to all employees successfully");
      setShow(false);
      setForm({ t: "", d: "", type: "Notice", scheduledFor: "", duration: "2 Hours" });
    } catch {
      toast("Failed to send announcement broadcast");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">Corporate Announcements</h1>
          <p className="text-sm text-muted-foreground">
            Real-time system bulletins and company-wide notifications.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Btn variant="outline" onClick={handleRefresh} disabled={isRefreshing}>
            <RefreshCw size={16} className={isRefreshing ? "animate-spin" : ""} /> Sync Real-Time
          </Btn>
          {canCreate && (
            <Btn onClick={() => setShow(true)}>
              <Send size={16} /> Broadcast Composer
            </Btn>
          )}
        </div>
      </div>

      <div className="space-y-4">
        {broadcasts.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground border border-dashed rounded-2xl">
            No system announcements available at this time.
          </div>
        ) : (
          broadcasts.map((b) => {
            const cat = getCategoryBadgeConfig(b.type);
            const isMaintenance =
              (b.type || "").toLowerCase().includes("maintenance") ||
              Boolean(b.scheduledFor || b.duration);

            return (
              <div key={b.id} className={cardCls + " space-y-4"}>
                <div className="flex justify-between items-start flex-wrap gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge tone={cat.tone}>
                        {cat.icon}
                        <span>{cat.label}</span>
                      </Badge>
                      <h3 className="font-bold text-lg text-foreground">{b.t}</h3>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Broadcast by {b.author} | {b.date}
                    </p>
                  </div>
                  <Badge tone="indigo">{b.read} Reads</Badge>
                </div>

                {/* Structured Maintenance Schedule Section */}
                {(b.scheduledFor || b.duration) && (
                  <div
                    className={`flex flex-wrap items-center gap-3 sm:gap-6 p-3.5 rounded-xl border ${
                      isMaintenance
                        ? "border-amber-500/30 bg-amber-500/10 text-amber-950 dark:text-amber-200"
                        : "border-border bg-muted/40 text-foreground"
                    }`}
                  >
                    {b.scheduledFor && (
                      <div className="flex items-center gap-2 text-xs font-medium">
                        <Clock
                          size={14}
                          className={isMaintenance ? "text-amber-500" : "text-primary"}
                        />
                        <span className="opacity-80">Scheduled Start:</span>
                        <span className="font-semibold font-mono">
                          {formatDateTime(b.scheduledFor)}
                        </span>
                      </div>
                    )}
                    {b.duration && (
                      <div className="flex items-center gap-2 text-xs font-medium">
                        <span className="opacity-80">Duration:</span>
                        <span className="font-semibold px-2 py-0.5 rounded-md bg-background/80 border border-border">
                          {b.duration}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{b.d}</p>
              </div>
            );
          })
        )}
      </div>

      {show && canCreate && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/60 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-lg shadow-2xl">
            <h3 className="text-lg font-bold mb-4">Compose Broadcast Bulletin</h3>
            <div className="space-y-4">
              <Field label="Announcement Category">
                <select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                  className={inputCls}
                >
                  <option value="Notice">General Notice</option>
                  <option value="Maintenance">Platform Maintenance</option>
                  <option value="Release">Release Updates</option>
                  <option value="Security">Security Advisory</option>
                </select>
              </Field>
              <Field label="Headline Title">
                <input
                  value={form.t}
                  onChange={(e) => setForm({ ...form, t: e.target.value })}
                  className={inputCls}
                  placeholder="e.g. Strategic Plan 2027 Relaunch"
                />
              </Field>
              {form.type === "Maintenance" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="Scheduled Start">
                    <input
                      type="datetime-local"
                      value={form.scheduledFor}
                      onChange={(e) => setForm({ ...form, scheduledFor: e.target.value })}
                      className={inputCls}
                    />
                  </Field>
                  <Field label="Duration">
                    <select
                      value={form.duration}
                      onChange={(e) => setForm({ ...form, duration: e.target.value })}
                      className={inputCls}
                    >
                      <option value="1 Hour">1 Hour</option>
                      <option value="2 Hours">2 Hours</option>
                      <option value="4 Hours">4 Hours</option>
                      <option value="6 Hours">6 Hours</option>
                      <option value="12 Hours">12 Hours</option>
                      <option value="1 Day">1 Day (24 Hours)</option>
                    </select>
                  </Field>
                </div>
              )}
              <Field label="Message Details">
                <textarea
                  value={form.d}
                  onChange={(e) => setForm({ ...form, d: e.target.value })}
                  className={inputCls + " min-h-[140px] py-2"}
                  placeholder="e.g. Please take note of the upcoming updates..."
                />
              </Field>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <Btn variant="outline" onClick={() => setShow(false)}>
                Cancel
              </Btn>
              <Btn onClick={add} disabled={isSubmitting}>
                {isSubmitting ? "Sending..." : "Broadcast Message"}
              </Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

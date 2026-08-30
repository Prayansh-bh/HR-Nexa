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

export function HRAnalyticsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">HR Analytics Reports</h1>
        <p className="text-sm text-muted-foreground">
          Demographics reports, attrition factors, and department distributions.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className={cardCls + " space-y-4"}>
          <h3 className="font-bold text-sm">Roster Headcount Ratio</h3>
          <div className="h-44 flex items-end gap-4 justify-center">
            <div className="flex flex-col items-center">
              <div className="w-12 bg-primary rounded-t-lg" style={{ height: "120px" }} />
              <span className="text-[10px] text-muted-foreground mt-2">Engineering (18)</span>
            </div>
            <div className="flex flex-col items-center">
              <div className="w-12 bg-primary-glow rounded-t-lg" style={{ height: "60px" }} />
              <span className="text-[10px] text-muted-foreground mt-2">Finance (6)</span>
            </div>
            <div className="flex flex-col items-center">
              <div
                className="w-12 bg-[color:var(--color-info)] rounded-t-lg"
                style={{ height: "40px" }}
              />
              <span className="text-[10px] text-muted-foreground mt-2">HR (4)</span>
            </div>
          </div>
        </div>

        <div className={cardCls + " space-y-4"}>
          <h3 className="font-bold text-sm">Attrition Trends (YoY)</h3>
          <div className="h-44 flex items-end gap-2 pt-4 justify-center">
            {[12, 10, 8, 9, 7, 5, 4, 3, 5, 4, 2, 1].map((l, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className="w-full bg-destructive rounded-t-sm"
                  style={{ height: `${l * 12}px` }}
                />
                <span className="text-[8px] text-muted-foreground">M{i + 1}</span>
              </div>
            ))}
          </div>
        </div>

        <div className={cardCls + " space-y-4"}>
          <h3 className="font-bold text-sm">Staff Diversity Balance</h3>
          <div className="space-y-3 pt-4 text-xs font-semibold">
            <div>
              <div className="flex justify-between mb-1">
                <span>Female</span>
                <span>48%</span>
              </div>
              <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-[color:var(--color-success)]" style={{ width: "48%" }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between mb-1">
                <span>Male</span>
                <span>52%</span>
              </div>
              <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-primary" style={{ width: "52%" }} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// 3. MANAGER PAGES
// -------------------------------------------------------------

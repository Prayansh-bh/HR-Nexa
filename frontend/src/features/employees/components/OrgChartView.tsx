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
import type { Broadcast, AuthUser, OrgChartEmployee } from "../../../types";
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
import { ModalShell, Avatar } from "../../../components/ui";

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

export interface TreeNode {
  employee: OrgChartEmployee;
  subordinates: TreeNode[];
}

function buildTree(employees: OrgChartEmployee[]): TreeNode[] {
  if (!Array.isArray(employees) || employees.length === 0) {
    return [];
  }

  const nodeMap = new Map<string, TreeNode>();
  const childrenMap = new Map<string, string[]>();
  const allIds = new Set(employees.map((e) => e.id));

  employees.forEach((emp) => {
    nodeMap.set(emp.id, { employee: emp, subordinates: [] });
    childrenMap.set(emp.id, []);
  });

  const rootIds: string[] = [];

  employees.forEach((emp) => {
    const parentId = emp.managerId;
    if (parentId && allIds.has(parentId) && parentId !== emp.id) {
      childrenMap.get(parentId)!.push(emp.id);
    } else {
      rootIds.push(emp.id);
    }
  });

  const state = new Map<string, number>();
  employees.forEach((emp) => state.set(emp.id, 0));

  const validRoots: string[] = [...rootIds];

  const dfs = (nodeId: string) => {
    state.set(nodeId, 1);
    const children = childrenMap.get(nodeId) || [];
    const validChildren: string[] = [];

    for (const childId of children) {
      const childState = state.get(childId) ?? 0;
      if (childState === 1) {
        validRoots.push(childId);
      } else {
        if (childState === 0) {
          dfs(childId);
        }
        validChildren.push(childId);
      }
    }

    state.set(nodeId, 2);
    const parentNode = nodeMap.get(nodeId);
    if (parentNode) {
      parentNode.subordinates = validChildren
        .map((cid) => nodeMap.get(cid)!)
        .filter(Boolean);
    }
  };

  const finalRootSet = new Set(validRoots);
  finalRootSet.forEach((rootId) => {
    if (state.get(rootId) === 0) {
      dfs(rootId);
    }
  });

  employees.forEach((emp) => {
    if (state.get(emp.id) === 0) {
      finalRootSet.add(emp.id);
      dfs(emp.id);
    }
  });

  return Array.from(finalRootSet)
    .map((rid) => nodeMap.get(rid)!)
    .filter(Boolean);
}

function OrgTreeNodeCard({ employee, isRoot }: { employee: OrgChartEmployee; isRoot?: boolean }) {
  const designationText = employee.designation ?? "No Designation";
  const departmentText = employee.department ?? "No Department";
  const employeeName = employee.name || "Unnamed Employee";

  if (isRoot) {
    return (
      <div className="border-2 border-primary rounded-2xl p-4 bg-primary/5 text-center min-w-[200px] shadow-lg transition hover:scale-105">
        <Avatar
          src={employee.avatar}
          name={employeeName}
          size={48}
          className="mx-auto shadow"
          alt={employeeName}
        />
        <div className="font-bold text-base mt-2 text-foreground">{employeeName}</div>
        <div className="text-xs text-primary font-semibold mt-0.5">{designationText}</div>
        <div className="text-[10px] text-muted-foreground font-bold mt-1 uppercase tracking-wider">{departmentText}</div>
      </div>
    );
  }

  return (
    <div className="border border-border rounded-2xl p-4 bg-card text-center min-w-[180px] shadow-md hover:border-primary transition hover:shadow-lg">
      <Avatar
        src={employee.avatar}
        name={employeeName}
        size={36}
        className="mx-auto"
        alt={employeeName}
      />
      <div className="font-bold text-sm mt-2 text-foreground">{employeeName}</div>
      <div className="text-xs text-muted-foreground font-medium mt-0.5">{designationText}</div>
      <div className="text-[9px] text-primary font-bold mt-1 uppercase tracking-wider">{departmentText}</div>
    </div>
  );
}

function OrgTreeNodeView({ node, isRoot = false }: { node: TreeNode; isRoot?: boolean }) {
  const hasChildren = node.subordinates && node.subordinates.length > 0;

  return (
    <div className="flex flex-col items-center">
      <OrgTreeNodeCard employee={node.employee} isRoot={isRoot} />

      {hasChildren && (
        <>
          <div className="h-6 w-0.5 bg-border" />
          <div className="flex gap-8 items-start pt-2">
            {node.subordinates.map((childNode) => (
              <div key={childNode.employee.id} className="flex flex-col items-center relative">
                <div className="h-4 w-0.5 bg-border -mt-2 mb-2" />
                <OrgTreeNodeView node={childNode} isRoot={false} />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function OrgChartView({ employees, departments }: { employees: OrgChartEmployee[]; departments?: any[] }) {
  const treeRoots = useMemo(() => buildTree(employees || []), [employees]);

  if (!employees || employees.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Organization Tree Structure</h1>
          <p className="text-sm text-muted-foreground">
            Interactive display mapping report lines and division nodes.
          </p>
        </div>
        <div className="p-12 bg-card border border-border rounded-2xl text-center text-muted-foreground">
          No employees found to build organization chart.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Organization Tree Structure</h1>
        <p className="text-sm text-muted-foreground">
          Interactive display mapping reporting hierarchy based on direct reporting lines.
        </p>
      </div>

      <div className="p-8 bg-card border border-border rounded-2xl flex flex-col items-center gap-12 overflow-auto min-h-[400px]">
        {treeRoots.map((rootNode) => (
          <OrgTreeNodeView key={rootNode.employee.id} node={rootNode} isRoot={true} />
        ))}
      </div>
    </div>
  );
}

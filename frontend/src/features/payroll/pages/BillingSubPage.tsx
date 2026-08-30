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

export function BillingSubPage({ toast }: { toast: (m: string) => void }) {
  const [tier, setTier] = useState("Enterprise");
  const [cycle, setCycle] = useState("Monthly");
  const [amount, setAmount] = useState(336);
  const [seats, setSeats] = useState(42);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  const [checkoutInvoice, setCheckoutInvoice] = useState<Invoice | null>(null);
  const [paymentMethod, setPaymentMethod] = useState("Card (Demo)");
  const [processingPayment, setProcessingPayment] = useState(false);

  async function loadBilling() {
    try {
      setLoading(true);
      const subData = await subscriptionService.getSubscriptions();
      if (subData && subData.subscriptions && subData.subscriptions.length > 0) {
        const sub = subData.subscriptions[0];
        setTier(sub.plan);
        setCycle(sub.cycle);
        setAmount(sub.amount);
        if (typeof sub.employeesCount === "number") {
          setSeats(sub.employeesCount);
        } else if (typeof sub.usedSeats === "number") {
          setSeats(sub.usedSeats);
        }
      }
      const invData = await billingService.getInvoices();
      setInvoices(invData);
    } catch (err) {
      console.error("Failed to load billing data:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadBilling();
  }, []);

  const handleProcessPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkoutInvoice) return;
    try {
      setProcessingPayment(true);
      await billingService.processPayment({
        invoiceId: checkoutInvoice.id,
        company: checkoutInvoice.company,
        amount: checkoutInvoice.amount,
        paymentMethod,
      });
      if (toast) toast("Payment processed successfully! Your invoice is now marked as Paid.");
      setCheckoutInvoice(null);
      await loadBilling();
    } catch (err: any) {
      if (toast) toast(err?.message || "Failed to process payment");
    } finally {
      setProcessingPayment(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Billing & Subscription</h1>
        <p className="text-sm text-muted-foreground">
          Modify plan tier, seat allocation, invoices, and payment credentials.
        </p>
      </div>

      {loading ? (
        <div className="flex h-[30vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className={`${cardCls} md:col-span-2 space-y-6`}>
            <div>
              <h3 className="text-lg font-bold">Current Subscription Plan</h3>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-3xl font-extrabold text-primary">{tier} Tier</span>
                <Badge tone="green">Active</Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Billing Cycle: {cycle}</p>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between text-sm font-semibold">
                <span>Active Enrolled Employees / Seats:</span>
                <span className="text-primary font-bold">{seats} Active Users</span>
              </div>
              <div className="w-full bg-muted/60 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-primary h-full rounded-full transition-all"
                  style={{ width: `${Math.min(100, Math.max(10, seats))}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Auto-synced with Employee Directory</span>
                <span>Plan: {tier}</span>
              </div>
            </div>

            <div className="border-t border-border pt-4 flex items-center justify-between">
              <div>
                <div className="text-xs text-muted-foreground">Active Subscription Rate:</div>
                <div className="text-xl font-bold text-primary">₹{amount} / {cycle.toLowerCase()}</div>
              </div>
              <Badge tone="indigo">Automated Gateway Checkout</Badge>
            </div>
          </div>

          <div className={cardCls + " space-y-4"}>
            <h3 className="font-bold">Subscription Invoices</h3>
            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
              {invoices.map((inv) => (
                <div
                  key={inv.id}
                  className="flex justify-between items-center p-3 bg-muted/40 rounded-xl border border-border"
                >
                  <div>
                    <div className="text-[10px] text-muted-foreground font-mono">{inv.id}</div>
                    <div className="text-xs font-bold">{inv.date}</div>
                    <div className="text-sm font-semibold text-primary">₹{inv.amount}</div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <Badge
                      tone={inv.status === "Paid" || inv.status === "Processed" ? "green" : "amber"}
                    >
                      {inv.status}
                    </Badge>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          toast?.("Downloading invoice...");
                          downloadInvoiceHtml(inv);
                        }}
                        className="text-primary hover:underline text-[10px] font-semibold"
                      >
                        Download
                      </button>
                      {inv.status !== "Paid" &&
                        inv.status !== "Processed" &&
                        inv.status !== "Refunded" && (
                          <button
                            onClick={() => setCheckoutInvoice(inv)}
                            className="text-success hover:underline text-[10px] font-bold"
                          >
                            Pay Now
                          </button>
                        )}
                    </div>
                  </div>
                </div>
              ))}
              {invoices.length === 0 && (
                <div className="text-center py-6 text-xs text-muted-foreground">
                  No invoices generated yet.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {checkoutInvoice && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center gap-2 text-primary font-bold mb-4">
              <CreditCard /> Demo Payment Checkout
            </div>
            <p className="text-xs text-muted-foreground mb-4">
              Confirm payment for Invoice <strong>{checkoutInvoice.id}</strong>.
            </p>
            <form onSubmit={handleProcessPayment} className="space-y-4">
              <div className="p-3 bg-muted/40 rounded-xl border border-border mb-4">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-muted-foreground">Amount:</span>
                  <span className="font-bold text-primary">₹{checkoutInvoice.amount}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Company:</span>
                  <span className="font-semibold">{checkoutInvoice.company}</span>
                </div>
              </div>
              <Field label="Payment Method">
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className={inputCls}
                >
                  <option value="Stripe (Demo)">Stripe (Demo Payment Gateway)</option>
                  <option value="Card (Demo)">Credit/Debit Card (Demo)</option>
                  <option value="UPI (Demo)">UPI / Instant Pay (Demo)</option>
                  <option value="NetBanking (Demo)">Net Banking (Demo)</option>
                </select>
              </Field>
              <div className="flex justify-end gap-2 mt-6">
                <Btn variant="outline" type="button" onClick={() => setCheckoutInvoice(null)}>
                  Cancel
                </Btn>
                <Btn type="submit" disabled={processingPayment}>
                  {processingPayment ? "Processing..." : "Confirm Payment"}
                </Btn>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

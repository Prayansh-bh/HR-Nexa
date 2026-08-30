import React, { useState, useEffect, useMemo } from "react";
import {
  DollarSign,
  Download,
  Filter,
  Search,
  CheckCircle,
  Clock,
  AlertTriangle,
  FileSpreadsheet,
  Building2,
  X,
  RotateCcw,
  AlertCircle,
} from "lucide-react";
import { companyService } from "../../../services/company.service";
import { billingService, Invoice, PaymentRecord } from "../../../services/billing.service";
import { downloadInvoiceHtml } from "../../../utils/invoiceDownloader";
import { useSystemRuntimeSettingsQuery } from "../../../hooks/useSystemSettingsQuery";
import { formatCurrency } from "../../../utils/currency.utils";
import { formatDate } from "../../../utils/date.utils";
import { useUIStore } from "../../../store/uiStore";

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

export function BillingPaymentsPage({
  toast,
  initialInvoiceId,
}: {
  toast?: any;
  initialInvoiceId?: string;
}) {
  const { data: systemSettings } = useSystemRuntimeSettingsQuery();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | undefined>(initialInvoiceId);

  const [activeRefundPayment, setActiveRefundPayment] = useState<PaymentRecord | null>(null);
  const [refundAmount, setRefundAmount] = useState<string>("");
  const [refundReason, setRefundReason] = useState<string>("");
  const [isProcessingRefund, setIsProcessingRefund] = useState<boolean>(false);

  const rowRefs = React.useRef<Map<string, HTMLTableRowElement>>(new Map());

  useEffect(() => {
    if (initialInvoiceId) {
      setSelectedInvoiceId(initialInvoiceId);
    }
  }, [initialInvoiceId]);

  const fetchBillingData = async () => {
    try {
      setLoading(true);
      const [invData, payData] = await Promise.all([
        billingService.getInvoices(),
        billingService.getPayments(),
      ]);
      setInvoices(
        Array.isArray(invData?.data)
          ? invData.data
          : Array.isArray(invData)
          ? invData
          : [],
      );
      setPayments(Array.isArray(payData) ? payData : []);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Failed to fetch billing ledger data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBillingData();
  }, []);

  const selectedInvoice = useMemo(() => {
    if (!selectedInvoiceId) return null;
    return invoices.find((i) => i.id === selectedInvoiceId) || null;
  }, [invoices, selectedInvoiceId]);

  useEffect(() => {
    if (selectedInvoiceId && !loading && invoices.length > 0) {
      const row = rowRefs.current.get(selectedInvoiceId);
      if (row) {
        row.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  }, [selectedInvoiceId, loading, invoices]);

  const handleOpenRefundModal = (pay: PaymentRecord) => {
    const isGatewaySupported = Boolean(
      pay.gatewayPaymentId ||
        (pay.transactionId && pay.transactionId.startsWith("pay_")),
    );

    if (!isGatewaySupported) {
      toast?.(
        "Refund unavailable — this transaction has no verified gateway payment reference.",
        "error",
      );
      return;
    }

    const alreadyRefunded = pay.refundedAmount || 0;
    const remaining = Math.max(0, pay.amount - alreadyRefunded);
    if (remaining <= 0) {
      toast?.("This transaction has already been fully refunded.", "warning");
      return;
    }

    setActiveRefundPayment(pay);
    setRefundAmount(String(remaining));
    setRefundReason("");
  };

  const handleExecuteRefund = async () => {
    if (!activeRefundPayment) return;
    const numAmount = Number(refundAmount);
    const alreadyRefunded = activeRefundPayment.refundedAmount || 0;
    const remaining = Math.max(0, activeRefundPayment.amount - alreadyRefunded);

    if (isNaN(numAmount) || numAmount <= 0) {
      toast?.("Please enter a valid refund amount greater than 0", "error");
      return;
    }

    if (numAmount > remaining) {
      toast?.(
        `Refund amount exceeds remaining balance of ${formatInvoiceAmount(remaining)}`,
        "error",
      );
      return;
    }

    try {
      setIsProcessingRefund(true);
      await billingService.processRefund(activeRefundPayment.id, {
        amount: numAmount,
        reason: refundReason.trim() || undefined,
      });
      toast?.("Gateway refund submitted and processed successfully!", "success");
      setActiveRefundPayment(null);
      await fetchBillingData();
    } catch (err: any) {
      toast?.(err?.message || "Failed to process gateway refund", "error");
    } finally {
      setIsProcessingRefund(false);
    }
  };

  const formatInvoiceAmount = (value: number) => {
    return formatCurrency(value, systemSettings?.currency, { maximumFractionDigits: 0 });
  };

  if (loading && invoices.length === 0) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <div className="text-sm text-muted-foreground">Loading invoices and ledger...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 w-full max-w-7xl mx-auto min-w-0 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <PageHeader
          title="Billing & Payments"
          subtitle="View all invoices, receipts, and payment statuses"
        />
      </div>

      {error && (
        <div className="p-4 bg-destructive/15 text-destructive rounded-xl border border-destructive/20 text-sm">
          {error}
        </div>
      )}

      {/* Selected Invoice Banner */}
      {selectedInvoice && (
        <div className="p-4 bg-primary/10 border-2 border-primary/40 rounded-2xl flex flex-wrap items-center justify-between gap-4 animate-in fade-in zoom-in-95 duration-200">
          <div className="flex items-center gap-3 min-w-0">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary text-white font-bold">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h4 className="font-bold text-foreground truncate">
                Invoice {selectedInvoice.id} Selected
              </h4>
              <p className="text-xs text-muted-foreground truncate">
                {selectedInvoice.company} • {formatInvoiceAmount(selectedInvoice.amount)} • {selectedInvoice.status}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => {
                toast?.("Downloading invoice...", "info");
                downloadInvoiceHtml(selectedInvoice);
              }}
              className={btnCls}
            >
              <Download className="h-4 w-4 shrink-0" /> Download Statement
            </button>
            <button
              onClick={() => setSelectedInvoiceId(undefined)}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-border bg-card hover:bg-muted text-foreground transition"
            >
              Clear Selection
            </button>
          </div>
        </div>
      )}

      {/* Invoices Section */}
      <div className="space-y-3">
        <h3 className="text-lg font-bold text-foreground">Invoices & Statements</h3>
        <div className={cardCls + " p-0 overflow-hidden"}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-left text-sm border-collapse">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="p-4 font-semibold">Transaction ID</th>
                  <th className="p-4 font-semibold">Type</th>
                  <th className="p-4 font-semibold">Company</th>
                  <th className="p-4 font-semibold">Date</th>
                  <th className="p-4 font-semibold">Amount</th>
                  <th className="p-4 font-semibold">Status</th>
                  <th className="p-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {invoices.map((inv) => {
                  const isSelected = inv.id === selectedInvoiceId;
                  return (
                    <tr
                      key={inv.id}
                      ref={(el) => {
                        if (el) rowRefs.current.set(inv.id, el);
                        else rowRefs.current.delete(inv.id);
                      }}
                      className={
                        isSelected
                          ? "bg-primary/10 border-l-4 border-l-primary font-medium transition duration-200"
                          : "hover:bg-muted/30 transition"
                      }
                    >
                      <td className="p-4 font-medium text-primary whitespace-nowrap">{inv.id}</td>
                      <td className="p-4 whitespace-nowrap">{inv.type}</td>
                      <td className="p-4 font-semibold whitespace-nowrap">{inv.company}</td>
                      <td className="p-4 whitespace-nowrap">{formatDate(inv.date, systemSettings?.dateFormat, systemSettings?.timeZone)}</td>
                      <td className="p-4 font-bold whitespace-nowrap">{formatInvoiceAmount(inv.amount)}</td>
                      <td className="p-4 whitespace-nowrap">
                        <Badge
                          tone={
                            inv.status === "Paid" || inv.status === "Processed"
                              ? "green"
                              : inv.status === "Refunded"
                                ? "rose"
                                : "amber"
                          }
                        >
                          {inv.status}
                        </Badge>
                      </td>
                      <td className="p-4 text-right whitespace-nowrap">
                        <button
                          onClick={() => {
                            toast?.("Downloading invoice...", "info");
                            downloadInvoiceHtml(inv, systemSettings?.currency, systemSettings?.dateFormat);
                          }}
                          className="text-primary hover:underline text-xs font-semibold"
                        >
                          Download
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {invoices.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-muted-foreground text-xs">
                      No invoices generated yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Payment & Audit Ledger Section */}
      <div className="space-y-3">
        <h3 className="text-lg font-bold text-foreground">Transaction Ledger (Audit Trail)</h3>
        <div className={cardCls + " p-0 overflow-hidden"}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm border-collapse">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="p-4 font-semibold">Receipt ID</th>
                  <th className="p-4 font-semibold">Invoice Ref</th>
                  <th className="p-4 font-semibold">Company</th>
                  <th className="p-4 font-semibold">Amount</th>
                  <th className="p-4 font-semibold">Payment Method</th>
                  <th className="p-4 font-semibold">Gateway Transaction ID</th>
                  <th className="p-4 font-semibold">Type</th>
                  <th className="p-4 font-semibold">Status</th>
                  <th className="p-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {payments.map((pay) => {
                  const isGatewaySupported = Boolean(
                    pay.gatewayPaymentId ||
                      (pay.transactionId && pay.transactionId.startsWith("pay_")),
                  );
                  const alreadyRefunded = pay.refundedAmount || 0;
                  const remaining = Math.max(0, pay.amount - alreadyRefunded);
                  const isFullyRefunded = pay.status === "Refunded" || remaining <= 0;
                  const hasPendingRefund = pay.refunds?.some(
                    (r) => r.status === "REQUESTED" || r.status === "PENDING",
                  );
                  const latestRefund = pay.refunds?.[0];

                  return (
                    <tr key={pay.id} className="hover:bg-muted/30 transition">
                      <td className="p-4 font-medium text-xs font-mono whitespace-nowrap">
                        {pay.id.substring(0, 8)}...
                      </td>
                      <td className="p-4 text-xs font-mono text-muted-foreground whitespace-nowrap">
                        {pay.invoiceId || "N/A"}
                      </td>
                      <td className="p-4 font-semibold whitespace-nowrap">{pay.company}</td>
                      <td className="p-4 font-bold whitespace-nowrap">
                        <div>{formatInvoiceAmount(pay.amount)}</div>
                        {alreadyRefunded > 0 && (
                          <div className="text-[11px] font-normal text-rose-500">
                            ({formatInvoiceAmount(alreadyRefunded)} refunded)
                          </div>
                        )}
                      </td>
                      <td className="p-4 text-xs whitespace-nowrap">{pay.paymentMethod}</td>
                      <td className="p-4 text-xs font-mono whitespace-nowrap">
                        {isGatewaySupported ? (
                          <span className="text-primary font-semibold">
                            {pay.gatewayPaymentId || pay.transactionId}
                          </span>
                        ) : pay.transactionId?.startsWith("ref_demo_") ? (
                          <span className="text-muted-foreground italic">Legacy Demo Refund</span>
                        ) : pay.transactionId?.startsWith("tx_demo_") ? (
                          <span className="text-muted-foreground italic">Legacy Demo Record</span>
                        ) : (
                          <span className="text-muted-foreground">{pay.transactionId}</span>
                        )}
                      </td>
                      <td className="p-4 whitespace-nowrap">
                        <Badge tone={pay.type === "Payment" ? "indigo" : "amber"}>{pay.type}</Badge>
                      </td>
                      <td className="p-4 whitespace-nowrap space-y-1">
                        <div>
                          <Badge
                            tone={
                              pay.status === "Success"
                                ? "green"
                                : pay.status === "Refunded"
                                  ? "rose"
                                  : pay.status === "Partially Refunded"
                                    ? "amber"
                                    : "slate"
                            }
                          >
                            {pay.status}
                          </Badge>
                        </div>
                        {latestRefund && (
                          <div>
                            <Badge
                              tone={
                                latestRefund.status === "PROCESSED"
                                  ? "green"
                                  : latestRefund.status === "FAILED"
                                    ? "rose"
                                    : "amber"
                              }
                            >
                              {latestRefund.status === "PROCESSED"
                                ? "Refund Processed"
                                : latestRefund.status === "PENDING"
                                  ? "Refund Pending"
                                  : latestRefund.status === "REQUESTED"
                                    ? "Refund Requested"
                                    : "Refund Failed"}
                            </Badge>
                            {latestRefund.failureReason && (
                              <p
                                className="text-[10px] text-destructive max-w-[140px] truncate"
                                title={latestRefund.failureReason}
                              >
                                {latestRefund.failureReason}
                              </p>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="p-4 text-right whitespace-nowrap">
                        {pay.type === "Payment" ? (
                          !isGatewaySupported ? (
                            <span
                              className="text-muted-foreground text-xs italic cursor-help"
                              title="Refund unavailable — this transaction has no verified gateway payment reference."
                            >
                              Unavailable
                            </span>
                          ) : isFullyRefunded ? (
                            <span className="text-muted-foreground text-xs font-medium">Fully Refunded</span>
                          ) : hasPendingRefund ? (
                            <span className="text-amber-500 text-xs font-semibold animate-pulse">Pending...</span>
                          ) : (
                            <button
                              onClick={() => handleOpenRefundModal(pay)}
                              className="text-destructive hover:underline text-xs font-semibold"
                            >
                              Refund
                            </button>
                          )
                        ) : (
                          <span className="text-muted-foreground text-xs font-medium">None</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {payments.length === 0 && (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-muted-foreground text-xs">
                      No payment records found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Gateway Refund Modal */}
      {activeRefundPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-destructive/10 text-destructive">
                  <RotateCcw className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-foreground">Process Gateway Refund</h3>
                  <p className="text-xs text-muted-foreground">Direct Razorpay Server-to-Server Reversal</p>
                </div>
              </div>
              <button
                onClick={() => !isProcessingRefund && setActiveRefundPayment(null)}
                className="p-1 rounded-lg hover:bg-muted text-muted-foreground"
                disabled={isProcessingRefund}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 rounded-xl border border-border bg-muted/20 p-4 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Company:</span>
                <span className="font-semibold text-foreground">{activeRefundPayment.company}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Gateway Payment ID:</span>
                <span className="font-mono font-bold text-primary">
                  {activeRefundPayment.gatewayPaymentId || activeRefundPayment.transactionId}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Original Captured:</span>
                <span className="font-semibold text-foreground">
                  {formatInvoiceAmount(activeRefundPayment.amount)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Already Refunded:</span>
                <span className="font-semibold text-rose-500">
                  {formatInvoiceAmount(activeRefundPayment.refundedAmount || 0)}
                </span>
              </div>
              <div className="flex justify-between border-t border-border pt-2 font-bold text-foreground">
                <span>Remaining Refundable:</span>
                <span>
                  {formatInvoiceAmount(
                    Math.max(
                      0,
                      activeRefundPayment.amount - (activeRefundPayment.refundedAmount || 0),
                    ),
                  )}
                </span>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  Refund Amount (INR)
                </label>
                <input
                  type="number"
                  min="1"
                  max={Math.max(
                    0,
                    activeRefundPayment.amount - (activeRefundPayment.refundedAmount || 0),
                  )}
                  value={refundAmount}
                  onChange={(e) => setRefundAmount(e.target.value)}
                  disabled={isProcessingRefund}
                  className={inputCls}
                  placeholder="Enter refund amount"
                />
                <p className="text-[11px] text-muted-foreground mt-1">
                  Specify a partial amount or refund the full remaining balance.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  Reason for Refund (Optional)
                </label>
                <input
                  type="text"
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  disabled={isProcessingRefund}
                  className={inputCls}
                  placeholder="e.g. Plan downgraded, customer cancellation request"
                />
              </div>
            </div>

            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-start gap-2.5 text-xs text-amber-600 dark:text-amber-400">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>
                This operation calls Razorpay's refund API directly. Electronic reversals are final and funds will revert to the customer's payment method within 5–7 business days.
              </span>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setActiveRefundPayment(null)}
                disabled={isProcessingRefund}
                className="px-4 py-2 text-xs font-semibold rounded-lg hover:bg-muted transition text-foreground"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteRefund}
                disabled={isProcessingRefund}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-destructive text-white hover:bg-destructive/90 transition flex items-center gap-2 shadow-sm"
              >
                {isProcessingRefund ? (
                  <>
                    <div className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Processing via Razorpay...
                  </>
                ) : (
                  "Initiate Gateway Refund"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

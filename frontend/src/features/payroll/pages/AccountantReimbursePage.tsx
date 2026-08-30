import React, { useState } from "react";
import { Loader2, Download, CheckCircle2, XCircle, AlertCircle, FileText, Eye, ShieldAlert, CreditCard, Send } from "lucide-react";
import { Field, Btn, Badge, inputCls, cardCls } from "../../../components/ui/DashboardPrimitives";
import { ModalShell } from "../../../components/ui/ModalShell";
import { useTenantExpenseClaimsQuery, useExpenseClaimMutations } from "../../../hooks/useReimbursementsQuery";
import { useHasPermission } from "../../../auth/useHasPermission";
import { PERMISSIONS } from "../../../auth/permissions";

export function AccountantReimbursePage({ toast }: { toast: (m: string) => void }) {
  const canManage = useHasPermission(PERMISSIONS.EXPENSES_MANAGE);
  const canApprove = useHasPermission(PERMISSIONS.EXPENSES_APPROVE);
  const canPay = useHasPermission(PERMISSIONS.EXPENSES_PAY);

  const { data: claimsData, claims: claimsProp, isLoading, isError } = useTenantExpenseClaimsQuery();
  const claims =
    Array.isArray(claimsProp) && claimsProp.length > 0
      ? claimsProp
      : Array.isArray(claimsData)
      ? claimsData
      : (claimsData as any)?.data || [];
  const { reviewClaim, payClaim } = useExpenseClaimMutations();

  const [selectedAuditClaim, setSelectedAuditClaim] = useState<any | null>(null);
  const [auditDecision, setAuditDecision] = useState<"APPROVED" | "REJECTED" | "CORRECTION_REQUIRED">("APPROVED");
  const [auditRemarks, setAuditRemarks] = useState("");
  const [itemApprovals, setItemApprovals] = useState<Record<string, { approvedAmount: number; taxTreatment: "TAXABLE" | "NON_TAXABLE" }>>({});

  const [selectedPayClaim, setSelectedPayClaim] = useState<any | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"BANK_TRANSFER" | "PAYROLL" | "OFF_CYCLE">("BANK_TRANSFER");
  const [paymentReference, setPaymentReference] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleOpenAuditModal = (claim: any) => {
    if (!canApprove) {
      toast("You do not have permission to approve expense claims");
      return;
    }
    setSelectedAuditClaim(claim);
    setAuditDecision("APPROVED");
    setAuditRemarks(claim.remarks || "");

    const initialApprovals: Record<string, { approvedAmount: number; taxTreatment: "TAXABLE" | "NON_TAXABLE" }> = {};
    if (claim.items && Array.isArray(claim.items)) {
      claim.items.forEach((item: any) => {
        initialApprovals[item.id] = {
          approvedAmount: item.approvedAmount > 0 ? item.approvedAmount : item.amount,
          taxTreatment: item.taxTreatment || "NON_TAXABLE",
        };
      });
    }
    setItemApprovals(initialApprovals);
  };

  const handleSaveAudit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAuditClaim) return;

    setIsSubmitting(true);
    try {
      const formattedApprovals = Object.keys(itemApprovals).map((itemId) => ({
        itemId,
        approvedAmount: itemApprovals[itemId]?.approvedAmount || 0,
        taxTreatment: itemApprovals[itemId]?.taxTreatment || "NON_TAXABLE",
      }));

      await reviewClaim.mutateAsync({
        id: selectedAuditClaim.id,
        data: {
          decision: auditDecision,
          remarks: auditRemarks,
          itemApprovals: auditDecision === "APPROVED" ? formattedApprovals : [],
        },
      });

      toast(`Expense claim audit decision saved: ${auditDecision}`);
      setSelectedAuditClaim(null);
    } catch (err: any) {
      toast(err?.message || "Failed to submit review decision");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenPayModal = (claim: any) => {
    if (!canPay) {
      toast("You do not have permission to disburse reimbursement payments");
      return;
    }
    setSelectedPayClaim(claim);
    setPaymentMethod("BANK_TRANSFER");
    setPaymentReference(`NEFT-${Date.now().toString().slice(-6)}`);
  };

  const handleExecutePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPayClaim) return;

    setIsSubmitting(true);
    try {
      await payClaim.mutateAsync({
        id: selectedPayClaim.id,
        data: {
          paymentMethod,
          paymentReference,
        },
      });

      toast(`Disbursement complete for claim ${selectedPayClaim.claimNumber}!`);
      setSelectedPayClaim(null);
    } catch (err: any) {
      toast(err?.message || "Failed to execute payout");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDownloadNEFT = () => {
    const approvedClaims = claims.filter((c: any) => c.status === "APPROVED" || c.status === "PAYABLE" || c.status === "PAID");
    if (approvedClaims.length === 0) {
      toast("No approved claims available to export");
      return;
    }

    const output = approvedClaims
      .map((c: any) => `NEFT\t${(c.employee?.name || "Employee").padEnd(20)}\t${String(c.approvedAmount || c.totalAmount).padEnd(8)}\tSUCCESS\t${c.submittedAt ? c.submittedAt.slice(0, 10) : "2026-07-16"}`)
      .join("\n");
    const blob = new Blob([output], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `neft_batch_reimbursement_${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast("NEFT batch bank wire upload text file exported successfully");
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Process Reimbursement Claims</h1>
          <p className="text-sm text-muted-foreground">
            Audit employee expense receipts, approve line items, release disbursements, and export NEFT files.
          </p>
        </div>
        <Btn onClick={handleDownloadNEFT}>
          <Download size={16} /> Export NEFT Batch File
        </Btn>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          Loading reimbursement claims from database...
        </div>
      )}

      {isError && (
        <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm">
          Failed to load reimbursement claims. Please check user authorization.
        </div>
      )}

      {!isLoading && !isError && claims.length === 0 && (
        <div className="p-8 text-center rounded-2xl border border-dashed border-border text-muted-foreground space-y-2">
          <p className="text-base font-semibold">No Expense Claims Filed</p>
          <p className="text-xs">When employees submit travel or business expense claims, they will appear here for review and payout.</p>
        </div>
      )}

      {!isLoading && !isError && claims.length > 0 && (
        <div className="space-y-4">
          {claims.map((c: any) => (
            <div key={c.id} className={cardCls + " flex flex-col md:flex-row justify-between items-start md:items-center gap-4"}>
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground font-bold">
                    {c.claimNumber}
                  </span>
                  <span className="font-bold text-base text-foreground">
                    {c.employee?.name} — {c.title}
                  </span>
                  <Badge
                    tone={
                      c.status === "PAID"
                        ? "emerald"
                        : c.status === "APPROVED" || c.status === "PAYABLE"
                          ? "sky"
                          : c.status === "SUBMITTED"
                            ? "amber"
                            : c.status === "REJECTED"
                              ? "rose"
                              : "slate"
                    }
                  >
                    {c.status}
                  </Badge>
                  {c.paymentStatus === "PAID" && (
                    <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
                      PAID ({c.paymentMethod})
                    </span>
                  )}
                </div>

                <div className="flex gap-6 text-xs text-muted-foreground pt-1">
                  <div>
                    Claimed: <span className="font-bold text-foreground">₹{c.totalAmount?.toLocaleString("en-IN")}</span>
                  </div>
                  <div>
                    Approved: <span className="font-bold text-emerald-600">₹{c.approvedAmount?.toLocaleString("en-IN")}</span>
                  </div>
                  <div>
                    Submitted: <span className="font-bold text-foreground">{c.submittedAt ? c.submittedAt.slice(0, 10) : "Draft"}</span>
                  </div>
                </div>

                {c.items && c.items.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-2">
                    {c.items.map((item: any) => (
                      <div key={item.id} className="text-xs px-2.5 py-1 rounded-lg border border-border bg-muted/30 flex items-center gap-2">
                        <span className="font-bold text-primary">{item.category?.name}:</span>
                        <span>₹{item.amount?.toLocaleString("en-IN")}</span>
                        {item.receiptDocument && (
                          <span className="inline-flex items-center text-[10px] text-emerald-600 gap-0.5">
                            <FileText className="h-3 w-3" /> Receipt Attached
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                {canApprove && (c.status === "SUBMITTED" || c.status === "UNDER_REVIEW") && (
                  <Btn size="sm" onClick={() => handleOpenAuditModal(c)}>
                    Verify & Audit
                  </Btn>
                )}

                {canPay && (c.status === "APPROVED" || c.status === "PAYABLE") && c.paymentStatus !== "PAID" && (
                  <Btn size="sm" onClick={() => handleOpenPayModal(c)}>
                    <CreditCard size={14} /> Disburse Payment
                  </Btn>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Audit Modal */}
      {selectedAuditClaim && (
        <ModalShell title={`Audit Claim — ${selectedAuditClaim.claimNumber}`} onClose={() => setSelectedAuditClaim(null)}>
          <form onSubmit={handleSaveAudit} className="space-y-4">
            <div className="p-3 rounded-xl bg-muted/40 text-xs space-y-1">
              <div className="flex justify-between font-semibold">
                <span>Employee: {selectedAuditClaim.employee?.name}</span>
                <span>Claimed Total: ₹{selectedAuditClaim.totalAmount?.toLocaleString("en-IN")}</span>
              </div>
              <p className="text-muted-foreground">{selectedAuditClaim.title}</p>
            </div>

            <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
              <h4 className="text-xs font-bold uppercase text-muted-foreground">Itemized Line Items Approval</h4>
              {selectedAuditClaim.items?.map((item: any) => (
                <div key={item.id} className="p-3 rounded-xl border border-border bg-card space-y-2 text-xs">
                  <div className="flex justify-between font-bold">
                    <span>{item.category?.name} — {item.merchant || "Vendor"}</span>
                    <span className="text-primary">Claimed: ₹{item.amount?.toLocaleString("en-IN")}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Approved Amount (₹)">
                      <input
                        type="number"
                        min="0"
                        max={item.amount}
                        value={itemApprovals[item.id]?.approvedAmount ?? item.amount}
                        onChange={(e) =>
                          setItemApprovals({
                            ...itemApprovals,
                            [item.id]: {
                              ...itemApprovals[item.id],
                              approvedAmount: parseFloat(e.target.value) || 0,
                            },
                          })
                        }
                        className={inputCls}
                      />
                    </Field>

                    <Field label="Taxability">
                      <select
                        value={itemApprovals[item.id]?.taxTreatment || "NON_TAXABLE"}
                        onChange={(e: any) =>
                          setItemApprovals({
                            ...itemApprovals,
                            [item.id]: {
                              ...itemApprovals[item.id],
                              taxTreatment: e.target.value,
                            },
                          })
                        }
                        className={inputCls}
                      >
                        <option value="NON_TAXABLE">NON-TAXABLE (Business Reimbursement)</option>
                        <option value="TAXABLE">TAXABLE (Taxable Perquisite)</option>
                      </select>
                    </Field>
                  </div>
                </div>
              ))}
            </div>

            <Field label="Audit Decision">
              <select value={auditDecision} onChange={(e: any) => setAuditDecision(e.target.value)} className={inputCls}>
                <option value="APPROVED">APPROVE (Mark Payable)</option>
                <option value="REJECTED">REJECT (Disallow Payout)</option>
                <option value="CORRECTION_REQUIRED">REQUEST CORRECTION (Ask Employee to Edit)</option>
              </select>
            </Field>

            <Field label="Remarks">
              <textarea
                value={auditRemarks}
                onChange={(e) => setAuditRemarks(e.target.value)}
                className={inputCls + " h-20 py-2 resize-none"}
                placeholder="Audit remarks or notes..."
              />
            </Field>

            <div className="flex justify-end gap-2 pt-2">
              <Btn variant="outline" type="button" onClick={() => setSelectedAuditClaim(null)}>
                Cancel
              </Btn>
              <Btn type="submit" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : "Save Decision"}
              </Btn>
            </div>
          </form>
        </ModalShell>
      )}

      {/* Pay Modal */}
      {selectedPayClaim && (
        <ModalShell title={`Disburse Payment — ${selectedPayClaim.claimNumber}`} onClose={() => setSelectedPayClaim(null)}>
          <form onSubmit={handleExecutePayment} className="space-y-4">
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs space-y-1">
              <div className="flex justify-between font-bold text-emerald-900">
                <span>Payee: {selectedPayClaim.employee?.name}</span>
                <span>Payable Amount: ₹{selectedPayClaim.approvedAmount?.toLocaleString("en-IN")}</span>
              </div>
              <p className="text-emerald-700">Claim Title: {selectedPayClaim.title}</p>
            </div>

            <Field label="Payment Method">
              <select value={paymentMethod} onChange={(e: any) => setPaymentMethod(e.target.value)} className={inputCls}>
                <option value="BANK_TRANSFER">Direct Bank Transfer (NEFT / RTGS / IMPS)</option>
                <option value="PAYROLL">Include in Next Monthly Payroll Run</option>
                <option value="OFF_CYCLE">Off-Cycle Cash / Cheque Payout</option>
              </select>
            </Field>

            <Field label="Payment / UTR Transaction Reference">
              <input
                value={paymentReference}
                onChange={(e) => setPaymentReference(e.target.value)}
                placeholder="e.g. UTR1289401289 or NEFT-BATCH-8821"
                className={inputCls}
                required
              />
            </Field>

            <div className="flex justify-end gap-2 pt-2">
              <Btn variant="outline" type="button" onClick={() => setSelectedPayClaim(null)}>
                Cancel
              </Btn>
              <Btn type="submit" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : "Confirm Payout"}
              </Btn>
            </div>
          </form>
        </ModalShell>
      )}
    </div>
  );
}


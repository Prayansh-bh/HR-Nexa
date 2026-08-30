import React, { useState } from "react";
import { Loader2, CheckCircle2, XCircle, AlertCircle, FileText, Eye, ShieldAlert } from "lucide-react";
import { Field, Btn, Badge, inputCls, cardCls } from "../../../components/ui/DashboardPrimitives";
import { ModalShell } from "../../../components/ui/ModalShell";
import { useTenantTaxDeclarationsQuery, useTaxDeclarationMutations } from "../../../hooks/useTaxDeclarationsQuery";
import { useHasPermission } from "../../../auth/useHasPermission";
import { PERMISSIONS } from "../../../auth/permissions";

export function AccountantTaxDeclPage({ toast }: { toast: (m: string) => void }) {
  const canManage = useHasPermission(PERMISSIONS.TAX_DECLARATIONS_MANAGE);
  const { data: declsData, declarations: declarationsProp, isLoading, isError } = useTenantTaxDeclarationsQuery();
  const declarations =
    Array.isArray(declarationsProp) && declarationsProp.length > 0
      ? declarationsProp
      : Array.isArray(declsData)
      ? declsData
      : (declsData as any)?.data || [];
  const { auditDeclaration } = useTaxDeclarationMutations();

  const [selectedDecl, setSelectedDecl] = useState<any | null>(null);
  const [auditDecision, setAuditDecision] = useState<"APPROVED" | "REJECTED" | "CORRECTION_REQUIRED">("APPROVED");
  const [auditRemarks, setAuditRemarks] = useState("");
  const [itemApprovals, setItemApprovals] = useState<Record<string, number>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleOpenAuditModal = (decl: any) => {
    if (!canManage) {
      toast("You do not have permission to verify tax declarations");
      return;
    }
    setSelectedDecl(decl);
    setAuditDecision("APPROVED");
    setAuditRemarks(decl.remarks || "");

    // Pre-populate item approvals with declared amounts by default
    const initialApprovals: Record<string, number> = {};
    if (decl.items && Array.isArray(decl.items)) {
      decl.items.forEach((item: any) => {
        initialApprovals[item.id] = item.approvedAmount > 0 ? item.approvedAmount : item.declaredAmount;
      });
    }
    setItemApprovals(initialApprovals);
  };

  const handleSaveAudit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDecl) return;

    setIsSubmitting(true);
    try {
      const formattedApprovals = Object.keys(itemApprovals).map((itemId) => ({
        itemId,
        approvedAmount: itemApprovals[itemId] || 0,
      }));

      await auditDeclaration.mutateAsync({
        id: selectedDecl.id,
        data: {
          decision: auditDecision,
          remarks: auditRemarks,
          itemApprovals: auditDecision === "APPROVED" ? formattedApprovals : [],
        },
      });

      toast(`Tax declaration audit complete: ${auditDecision}`);
      setSelectedDecl(null);
    } catch (err: any) {
      toast(err?.message || "Failed to submit audit decision");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Employee Tax Declarations</h1>
          <p className="text-sm text-muted-foreground">
            Verify investment proof documentation, PAN entries, and approve/reject section deductions.
          </p>
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          Loading tax declarations from database...
        </div>
      )}

      {isError && (
        <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm">
          Failed to load tax declarations. Please check user authorization or network connection.
        </div>
      )}

      {!isLoading && !isError && declarations.length === 0 && (
        <div className="p-8 text-center rounded-2xl border border-dashed border-border text-muted-foreground space-y-2">
          <p className="text-base font-semibold">No Tax Declarations Submitted</p>
          <p className="text-xs">When employees submit investment declarations for the active fiscal year, they will appear here for audit.</p>
        </div>
      )}

      {!isLoading && !isError && declarations.length > 0 && (
        <div className="space-y-4">
          {declarations.map((d: any) => (
            <div key={d.id} className={cardCls + " flex justify-between items-start"}>
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <span className="font-bold text-base text-foreground">
                    {d.employee?.name || "Employee"}
                  </span>
                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-muted text-muted-foreground">
                    PAN: {d.employee?.pan || "N/A"}
                  </span>
                  <Badge
                    tone={
                      d.status === "APPROVED"
                        ? "emerald"
                        : d.status === "SUBMITTED"
                          ? "amber"
                          : d.status === "REJECTED"
                            ? "rose"
                            : "slate"
                    }
                  >
                    {d.status}
                  </Badge>
                  <span className="text-xs font-semibold text-primary">
                    {d.regime} TAX REGIME
                  </span>
                </div>

                <div className="flex gap-6 text-xs text-muted-foreground pt-1">
                  <div>
                    Period: <span className="font-bold text-foreground">{d.fiscalYear?.name || "Active FY"}</span>
                  </div>
                  <div>
                    Declared Total: <span className="font-bold text-foreground">₹{d.totalDeclared?.toLocaleString("en-IN")}</span>
                  </div>
                  <div>
                    Approved Total: <span className="font-bold text-emerald-600">₹{d.totalApproved?.toLocaleString("en-IN")}</span>
                  </div>
                  <div>
                    Submitted: <span className="font-bold text-foreground">{d.submittedAt ? d.submittedAt.slice(0, 10) : "Draft"}</span>
                  </div>
                </div>

                {d.items && d.items.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-2">
                    {d.items.map((item: any) => (
                      <div key={item.id} className="text-xs px-2.5 py-1 rounded-lg border border-border bg-muted/30 flex items-center gap-2">
                        <span className="font-bold text-primary">{item.section}:</span>
                        <span>{item.category}</span>
                        <span className="font-mono text-muted-foreground">₹{item.declaredAmount?.toLocaleString("en-IN")}</span>
                        {item.proofDocument && (
                          <span className="inline-flex items-center text-[10px] text-emerald-600 gap-0.5">
                            <FileText className="h-3 w-3" /> Proof
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {canManage && (d.status === "SUBMITTED" || d.status === "UNDER_REVIEW") && (
                <Btn size="sm" onClick={() => handleOpenAuditModal(d)}>
                  Verify & Audit
                </Btn>
              )}
            </div>
          ))}
        </div>
      )}

      {selectedDecl && (
        <ModalShell
          onClose={() => setSelectedDecl(null)}
          title={`Audit Tax Declaration — ${selectedDecl.employee?.name}`}
        >
          <form onSubmit={handleSaveAudit} className="space-y-4">
            <div className="p-3 rounded-xl bg-muted/40 text-xs space-y-1">
              <div className="flex justify-between font-semibold">
                <span>Employee PAN: {selectedDecl.employee?.pan || "N/A"}</span>
                <span>Tax Regime: {selectedDecl.regime}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Fiscal Year: {selectedDecl.fiscalYear?.name}</span>
                <span>Declared Total: ₹{selectedDecl.totalDeclared?.toLocaleString("en-IN")}</span>
              </div>
            </div>

            <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
              <h4 className="text-xs font-bold uppercase text-muted-foreground">Itemized Deduction Auditing</h4>
              {selectedDecl.items?.map((item: any) => (
                <div key={item.id} className="p-3 rounded-xl border border-border bg-card space-y-2 text-xs">
                  <div className="flex justify-between font-bold">
                    <span>{item.section} — {item.category}</span>
                    <span className="text-primary">Declared: ₹{item.declaredAmount?.toLocaleString("en-IN")}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="text-muted-foreground">Approved Amount (₹):</label>
                    <input
                      type="number"
                      min="0"
                      max={item.declaredAmount}
                      value={itemApprovals[item.id] ?? item.declaredAmount}
                      onChange={(e) =>
                        setItemApprovals({
                          ...itemApprovals,
                          [item.id]: parseFloat(e.target.value) || 0,
                        })
                      }
                      className={inputCls + " max-w-[140px]"}
                    />
                  </div>
                  {item.proofDocument && (
                    <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <FileText className="h-3.5 w-3.5 text-primary" />
                      Linked Proof: {item.proofDocument.fileName} ({item.proofDocument.size})
                    </div>
                  )}
                </div>
              ))}
            </div>

            <Field label="Audit Decision">
              <select
                value={auditDecision}
                onChange={(e: any) => setAuditDecision(e.target.value)}
                className={inputCls}
              >
                <option value="APPROVED">APPROVE (Accept Deductions)</option>
                <option value="REJECTED">REJECT (Disallow Deductions)</option>
                <option value="CORRECTION_REQUIRED">REQUEST CORRECTION (Ask Employee to Re-upload)</option>
              </select>
            </Field>

            <Field label="Audit Remarks">
              <textarea
                value={auditRemarks}
                onChange={(e) => setAuditRemarks(e.target.value)}
                className={inputCls + " h-20 py-2 resize-none"}
                placeholder="Enter notes or audit feedback for the employee..."
              />
            </Field>

            <div className="flex justify-end gap-2 pt-2">
              <Btn variant="outline" type="button" onClick={() => setSelectedDecl(null)}>
                Cancel
              </Btn>
              <Btn type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Submitting...
                  </>
                ) : (
                  "Save Decision"
                )}
              </Btn>
            </div>
          </form>
        </ModalShell>
      )}
    </div>
  );
}


// -------------------------------------------------------------
// 5. EMPLOYEE SELF-SERVICE PAGES
// -------------------------------------------------------------

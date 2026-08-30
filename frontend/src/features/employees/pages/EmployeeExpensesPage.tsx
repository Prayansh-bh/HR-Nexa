import React, { useState } from "react";
import { Plus, Trash2, Send, Loader2, FileText, CheckCircle2, ShieldCheck, Download, AlertCircle } from "lucide-react";
import { Field, Btn, Badge, inputCls, cardCls } from "../../../components/ui/DashboardPrimitives";
import { ModalShell } from "../../../components/ui/ModalShell";
import { useMyExpenseClaimsQuery, useExpenseCategoriesQuery, useExpenseClaimMutations } from "../../../hooks/useReimbursementsQuery";
import { useFiscalYearsQuery } from "../../../hooks/useFiscalYearsQuery";
import { useHasPermission } from "../../../auth/useHasPermission";
import { PERMISSIONS } from "../../../auth/permissions";
import { useUIStore } from "../../../store";

export function EmployeeExpensesPage({ toast }: { toast: (m: string) => void }) {
  const canSubmit = useHasPermission(PERMISSIONS.EXPENSES_SUBMIT);
  const { data: fiscals = [] } = useFiscalYearsQuery();
  const activeFy = fiscals.find((f: any) => f.status === "ACTIVE") || fiscals[0];

  const { data: categories = [] } = useExpenseCategoriesQuery();
  const { data: claimsData, claims: claimsProp, isLoading, isError } = useMyExpenseClaimsQuery(activeFy?.id);
  const claims =
    Array.isArray(claimsProp) && claimsProp.length > 0
      ? claimsProp
      : Array.isArray(claimsData)
      ? claimsData
      : (claimsData as any)?.data || [];

  const { createMyClaim, submitMyClaim } = useExpenseClaimMutations();

  const [showModal, setShowModal] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [items, setItems] = useState<Array<{ categoryId: string; amount: number; expenseDate: string; merchant: string; description: string; receiptDocumentId?: string }>>([
    { categoryId: "", amount: 0, expenseDate: new Date().toISOString().slice(0, 10), merchant: "", description: "" },
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAddItem = () => {
    setItems([
      ...items,
      { categoryId: categories[0]?.id || "", amount: 0, expenseDate: new Date().toISOString().slice(0, 10), merchant: "", description: "" },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleSaveClaim = async (e: React.FormEvent, submitImmediately = false) => {
    e.preventDefault();
    if (!canSubmit) {
      toast("You do not have permission to submit expense claims");
      return;
    }
    if (!activeFy?.id) {
      toast("No active fiscal year found");
      return;
    }
    if (!title.trim()) {
      toast("Please enter a claim title");
      return;
    }
    if (items.some((i) => !i.categoryId || i.amount <= 0)) {
      toast("Please select a category and enter a positive amount for all line items");
      return;
    }

    setIsSubmitting(true);
    try {
      const created = await createMyClaim.mutateAsync({
        fiscalYearId: activeFy.id,
        title,
        description,
        items,
      });

      if (submitImmediately) {
        await submitMyClaim.mutateAsync(created.id);
        toast(`Claim ${created.claimNumber} filed and submitted for review!`);
      } else {
        toast(`Claim ${created.claimNumber} saved as draft!`);
      }

      setShowModal(false);
      setTitle("");
      setDescription("");
      setItems([{ categoryId: "", amount: 0, expenseDate: new Date().toISOString().slice(0, 10), merchant: "", description: "" }]);
    } catch (err: any) {
      toast(err?.message || "Failed to create expense claim");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitDraft = (claimId: string, claimNumber: string) => {
    useUIStore.getState().setConfirmState({
      open: true,
      title: "Submit Expense Claim",
      message: `Are you sure you want to submit claim "${claimNumber}" for accountant review? Submitted claims cannot be directly edited.`,
      confirmText: "Submit Claim",
      cancelText: "Cancel",
      confirmVariant: "primary",
      onConfirm: async () => {
        try {
          await submitMyClaim.mutateAsync(claimId);
          toast(`Claim ${claimNumber} submitted for review!`);
        } catch (err: any) {
          toast(err?.message || "Failed to submit claim");
        }
      },
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Reimbursements & Claims</h1>
          <p className="text-sm text-muted-foreground">
            File expense receipts, track approval & payout status for {activeFy?.name || "Active Period"}.
          </p>
        </div>
        {canSubmit && (
          <Btn onClick={() => setShowModal(true)}>
            <Plus size={16} /> File New Claim
          </Btn>
        )}
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          Loading expense claims...
        </div>
      )}

      {isError && (
        <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm">
          Failed to load expense claims. Please check network connection.
        </div>
      )}

      {!isLoading && !isError && claims.length === 0 && (
        <div className="p-8 text-center rounded-2xl border border-dashed border-border text-muted-foreground space-y-2">
          <p className="text-base font-semibold">No Expense Claims Found</p>
          <p className="text-xs">File your business travel, client entertainment, or internet expenses for reimbursement.</p>
        </div>
      )}

      {!isLoading && !isError && claims.length > 0 && (
        <div className="space-y-3">
          {claims.map((c: any) => (
            <div key={c.id} className={cardCls + " flex flex-col md:flex-row justify-between items-start md:items-center gap-4"}>
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground font-bold">
                    {c.claimNumber}
                  </span>
                  <span className="font-bold text-base text-foreground">{c.title}</span>
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
                      PAID OUT ({c.paymentMethod})
                    </span>
                  )}
                </div>

                <div className="flex gap-6 text-xs text-muted-foreground pt-1">
                  <div>
                    Claimed Total: <span className="font-bold text-foreground">₹{c.totalAmount?.toLocaleString("en-IN")}</span>
                  </div>
                  <div>
                    Approved Amount: <span className="font-bold text-emerald-600">₹{c.approvedAmount?.toLocaleString("en-IN")}</span>
                  </div>
                  <div>
                    Submitted: <span className="font-bold text-foreground">{c.submittedAt ? c.submittedAt.slice(0, 10) : "Draft"}</span>
                  </div>
                </div>

                {c.items && c.items.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-2">
                    {c.items.map((item: any) => (
                      <div key={item.id} className="text-xs px-2.5 py-1 rounded-lg border border-border bg-muted/30 flex items-center gap-2">
                        <span className="font-bold text-primary">{item.category?.name || "Expense"}:</span>
                        <span className="font-mono">₹{item.amount?.toLocaleString("en-IN")}</span>
                        <span className="text-muted-foreground">({item.expenseDate?.slice(0, 10)})</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {c.status === "DRAFT" && (
                <Btn size="sm" onClick={() => handleSubmitDraft(c.id, c.claimNumber)}>
                  <Send size={14} /> Submit Draft
                </Btn>
              )}
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <ModalShell title="File Reimbursement Claim" onClose={() => setShowModal(false)} wide>
          <form onSubmit={(e) => handleSaveClaim(e, false)} className="space-y-4">
            <Field label="Claim Title">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Mumbai Onsite Client Visit Expenses"
                className={inputCls}
                required
              />
            </Field>

            <Field label="Description / Purpose">
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief business context for accounting audit..."
                className={inputCls}
              />
            </Field>

            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <h4 className="text-xs font-bold uppercase text-muted-foreground">Expense Line Items</h4>
                <Btn variant="outline" size="sm" type="button" onClick={handleAddItem}>
                  <Plus size={14} /> Add Line Item
                </Btn>
              </div>

              {items.map((item, idx) => (
                <div key={idx} className="p-3 rounded-xl border border-border bg-muted/20 space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <Field label="Category">
                      <select
                        value={item.categoryId}
                        onChange={(e) => {
                          const newItems = [...items];
                          newItems[idx].categoryId = e.target.value;
                          setItems(newItems);
                        }}
                        className={inputCls}
                        required
                      >
                        <option value="">Select Category...</option>
                        {categories.map((cat: any) => (
                          <option key={cat.id} value={cat.id}>
                            {cat.name} {cat.maxLimit ? `(Max ₹${cat.maxLimit})` : ""}
                          </option>
                        ))}
                      </select>
                    </Field>

                    <Field label="Amount (₹)">
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={item.amount || ""}
                        onChange={(e) => {
                          const newItems = [...items];
                          newItems[idx].amount = parseFloat(e.target.value) || 0;
                          setItems(newItems);
                        }}
                        className={inputCls}
                        required
                      />
                    </Field>

                    <Field label="Expense Date">
                      <input
                        type="date"
                        value={item.expenseDate}
                        onChange={(e) => {
                          const newItems = [...items];
                          newItems[idx].expenseDate = e.target.value;
                          setItems(newItems);
                        }}
                        className={inputCls}
                        required
                      />
                    </Field>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Field label="Merchant / Vendor">
                      <input
                        value={item.merchant}
                        onChange={(e) => {
                          const newItems = [...items];
                          newItems[idx].merchant = e.target.value;
                          setItems(newItems);
                        }}
                        placeholder="e.g. Uber / Taj Hotel"
                        className={inputCls}
                      />
                    </Field>

                    <Field label="Item Notes">
                      <input
                        value={item.description}
                        onChange={(e) => {
                          const newItems = [...items];
                          newItems[idx].description = e.target.value;
                          setItems(newItems);
                        }}
                        placeholder="Line item details..."
                        className={inputCls}
                      />
                    </Field>
                  </div>

                  {items.length > 1 && (
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(idx)}
                        className="text-xs text-destructive hover:underline flex items-center gap-1"
                      >
                        <Trash2 size={12} /> Remove Item
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="flex justify-between items-center pt-2">
              <span className="text-sm font-bold">
                Total Claim Amount:{" "}
                <span className="text-primary font-mono font-bold">
                  ₹{items.reduce((sum, i) => sum + (i.amount || 0), 0).toLocaleString("en-IN")}
                </span>
              </span>

              <div className="flex gap-2">
                <Btn variant="outline" type="button" onClick={() => setShowModal(false)}>
                  Cancel
                </Btn>
                <Btn variant="outline" type="submit" disabled={isSubmitting}>
                  Save Draft
                </Btn>
                <Btn type="button" onClick={() => handleSaveClaim({ preventDefault: () => {} } as any, true)} disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} Save & Submit
                </Btn>
              </div>
            </div>
          </form>
        </ModalShell>
      )}
    </div>
  );
}

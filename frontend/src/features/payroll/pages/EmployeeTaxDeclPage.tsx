import React, { useState, useEffect } from "react";
import { Plus, Trash2, Send, Loader2, FileText, CheckCircle2, ShieldCheck } from "lucide-react";
import { Field, Btn, Badge, inputCls, cardCls } from "../../../components/ui/DashboardPrimitives";
import { useMyTaxDeclarationQuery, useTaxDeclarationMutations } from "../../../hooks/useTaxDeclarationsQuery";
import { useFiscalYearsQuery } from "../../../hooks/useFiscalYearsQuery";
import { useHasPermission } from "../../../auth/useHasPermission";
import { PERMISSIONS } from "../../../auth/permissions";
import { useUIStore } from "../../../store";

const COMMON_SECTIONS = [
  { code: "80C", label: "Section 80C (PPF, ELSS, EPF, LIC, Tuition Fee — Max ₹1.5L)" },
  { code: "80D", label: "Section 80D (Health Insurance Premium)" },
  { code: "80CCD_1B", label: "Section 80CCD(1B) (NPS Voluntary Contribution — Max ₹50k)" },
  { code: "24B", label: "Section 24(b) (Home Loan Interest — Max ₹2L)" },
  { code: "10_13A", label: "Section 10(13A) (HRA Rent Paid)" },
  { code: "80E", label: "Section 80E (Education Loan Interest)" },
  { code: "80G", label: "Section 80G (Eligible Donations)" },
];

export function EmployeeTaxDeclPage({ toast }: { toast: (m: string) => void }) {
  const canSubmit = useHasPermission(PERMISSIONS.TAX_DECLARATIONS_SUBMIT);
  const { data: fiscals = [] } = useFiscalYearsQuery();
  const activeFy = fiscals.find((f: any) => f.status === "ACTIVE") || fiscals[0];

  const { data: decl, isLoading, isError } = useMyTaxDeclarationQuery(activeFy?.id);
  const { createMyDeclaration, updateMyDeclaration, submitMyDeclaration } = useTaxDeclarationMutations();

  const [regime, setRegime] = useState<"OLD" | "NEW">("OLD");
  const [items, setItems] = useState<Array<{ section: string; category: string; declaredAmount: number; remarks: string }>>([
    { section: "80C", category: "PPF / ELSS Mutual Funds", declaredAmount: 150000, remarks: "" },
    { section: "80D", category: "Mediclaim Policy", declaredAmount: 25000, remarks: "" },
  ]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (decl) {
      setRegime(decl.regime);
      if (decl.items && decl.items.length > 0) {
        setItems(
          decl.items.map((i: any) => ({
            section: i.section,
            category: i.category,
            declaredAmount: i.declaredAmount,
            remarks: i.remarks || "",
          })),
        );
      }
    }
  }, [decl]);

  const handleAddItem = () => {
    setItems([...items, { section: "80C", category: "", declaredAmount: 0, remarks: "" }]);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleSaveDraft = async () => {
    if (!canSubmit) {
      toast("You do not have permission to submit tax declarations");
      return;
    }
    if (!activeFy?.id) {
      toast("No active fiscal year found");
      return;
    }

    setIsSaving(true);
    try {
      if (decl) {
        await updateMyDeclaration.mutateAsync({
          fiscalYearId: activeFy.id,
          regime,
          items,
        });
        toast("Tax declaration draft updated");
      } else {
        await createMyDeclaration.mutateAsync({
          fiscalYearId: activeFy.id,
          regime,
          items,
        });
        toast("Tax declaration draft saved");
      }
    } catch (err: any) {
      toast(err?.message || "Failed to save tax declaration draft");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmit = () => {
    if (!canSubmit) {
      toast("You do not have permission to submit tax declarations");
      return;
    }
    if (!activeFy?.id) {
      toast("No active fiscal year found");
      return;
    }

    useUIStore.getState().setConfirmState({
      open: true,
      title: "Submit Tax Declaration",
      message: "Are you sure you want to submit your tax declaration for accountant review? Submitted declarations cannot be directly edited.",
      confirmText: "Submit Declaration",
      cancelText: "Review More",
      confirmVariant: "primary",
      onConfirm: async () => {
        setIsSaving(true);
        try {
          if (!decl) {
            await createMyDeclaration.mutateAsync({
              fiscalYearId: activeFy.id,
              regime,
              items,
            });
          } else {
            await updateMyDeclaration.mutateAsync({
              fiscalYearId: activeFy.id,
              regime,
              items,
            });
          }
          await submitMyDeclaration.mutateAsync(activeFy.id);
          toast("Tax declaration submitted for accountant review!");
        } catch (err: any) {
          toast(err?.message || "Failed to submit tax declaration");
        } finally {
          setIsSaving(false);
        }
      },
    });
  };

  const isReadOnly = decl && (decl.status === "SUBMITTED" || decl.status === "APPROVED" || decl.status === "UNDER_REVIEW");

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">My Tax Declaration</h1>
          <p className="text-sm text-muted-foreground">
            Declare tax-saving investments and select tax regime for {activeFy?.name || "Active Period"}.
          </p>
        </div>

        {decl && (
          <Badge
            tone={
              decl.status === "APPROVED"
                ? "emerald"
                : decl.status === "SUBMITTED"
                  ? "amber"
                  : decl.status === "REJECTED"
                    ? "rose"
                    : "slate"
            }
          >
            {decl.status}
          </Badge>
        )}
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          Loading your tax declaration...
        </div>
      )}

      {isError && (
        <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm">
          Failed to load tax declaration. Please check network connection.
        </div>
      )}

      {!isLoading && (
        <div className="space-y-6">
          {/* Regime Selector */}
          <div className={cardCls + " space-y-4"}>
            <h3 className="text-base font-bold">Tax Regime Selection</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label
                className={`p-4 rounded-xl border cursor-pointer transition flex flex-col gap-1 ${
                  regime === "OLD" ? "border-primary bg-primary/5 ring-2 ring-primary/20" : "border-border hover:border-primary/50"
                }`}
              >
                <div className="flex justify-between items-center">
                  <span className="font-bold text-sm">Old Tax Regime</span>
                  <input
                    type="radio"
                    name="regime"
                    value="OLD"
                    checked={regime === "OLD"}
                    onChange={() => !isReadOnly && setRegime("OLD")}
                    disabled={isReadOnly}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Allows claiming section deductions (80C, 80D, HRA, Home Loan Interest).
                </p>
              </label>

              <label
                className={`p-4 rounded-xl border cursor-pointer transition flex flex-col gap-1 ${
                  regime === "NEW" ? "border-primary bg-primary/5 ring-2 ring-primary/20" : "border-border hover:border-primary/50"
                }`}
              >
                <div className="flex justify-between items-center">
                  <span className="font-bold text-sm">New Tax Regime (Default)</span>
                  <input
                    type="radio"
                    name="regime"
                    value="NEW"
                    checked={regime === "NEW"}
                    onChange={() => !isReadOnly && setRegime("NEW")}
                    disabled={isReadOnly}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Lower tax slab rates with standard deduction (₹75,000). Section 80C/80D deductions do not apply.
                </p>
              </label>
            </div>
          </div>

          {/* Deductions Form (Old Regime Only) */}
          {regime === "OLD" && (
            <div className={cardCls + " space-y-4"}>
              <div className="flex justify-between items-center">
                <h3 className="text-base font-bold">Itemized Investment Deductions</h3>
                {!isReadOnly && (
                  <Btn variant="outline" size="sm" onClick={handleAddItem}>
                    <Plus className="h-4 w-4" /> Add Item
                  </Btn>
                )}
              </div>

              <div className="space-y-3">
                {items.map((item, idx) => (
                  <div key={idx} className="p-4 rounded-xl border border-border bg-muted/20 space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <Field label="Section">
                        <select
                          value={item.section}
                          onChange={(e) => {
                            const newItems = [...items];
                            newItems[idx].section = e.target.value;
                            setItems(newItems);
                          }}
                          disabled={isReadOnly}
                          className={inputCls}
                        >
                          {COMMON_SECTIONS.map((s) => (
                            <option key={s.code} value={s.code}>
                              {s.label}
                            </option>
                          ))}
                        </select>
                      </Field>

                      <Field label="Category / Provider">
                        <input
                          value={item.category}
                          onChange={(e) => {
                            const newItems = [...items];
                            newItems[idx].category = e.target.value;
                            setItems(newItems);
                          }}
                          placeholder="e.g. PPF / LIC Policy"
                          disabled={isReadOnly}
                          className={inputCls}
                        />
                      </Field>

                      <Field label="Declared Amount (₹)">
                        <input
                          type="number"
                          min="0"
                          value={item.declaredAmount}
                          onChange={(e) => {
                            const newItems = [...items];
                            newItems[idx].declaredAmount = parseFloat(e.target.value) || 0;
                            setItems(newItems);
                          }}
                          disabled={isReadOnly}
                          className={inputCls}
                        />
                      </Field>
                    </div>

                    <div className="flex justify-between items-center pt-1">
                      <input
                        value={item.remarks}
                        onChange={(e) => {
                          const newItems = [...items];
                          newItems[idx].remarks = e.target.value;
                          setItems(newItems);
                        }}
                        placeholder="Optional remarks..."
                        disabled={isReadOnly}
                        className={inputCls + " text-xs max-w-md"}
                      />

                      {!isReadOnly && items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Summary & Submission Actions */}
          <div className={cardCls + " flex flex-col md:flex-row justify-between items-center gap-4"}>
            <div className="space-y-1">
              <p className="text-sm font-bold">
                Total Declared Amount:{" "}
                <span className="text-primary font-mono">
                  ₹
                  {(regime === "OLD"
                    ? items.reduce((s, i) => s + (i.declaredAmount || 0), 0)
                    : 0
                  ).toLocaleString("en-IN")}
                </span>
              </p>
              {decl?.totalApproved !== undefined && (
                <p className="text-xs text-muted-foreground">
                  Total Approved Amount: <span className="font-bold text-emerald-600">₹{decl.totalApproved.toLocaleString("en-IN")}</span>
                </p>
              )}
            </div>

            {!isReadOnly && canSubmit && (
              <div className="flex gap-2">
                <Btn variant="outline" onClick={handleSaveDraft} disabled={isSaving}>
                  Save Draft
                </Btn>
                <Btn onClick={handleSubmit} disabled={isSaving}>
                  {isSaving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Submitting...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" /> Submit for Review
                    </>
                  )}
                </Btn>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

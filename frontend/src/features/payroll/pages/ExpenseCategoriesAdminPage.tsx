import React, { useState } from "react";
import {
  Loader2,
  Plus,
  Edit2,
  ShieldAlert,
  Layers,
  CheckCircle2,
  XCircle,
  Receipt,
  Coins,
  Percent,
} from "lucide-react";
import {
  Field,
  Btn,
  Badge,
  inputCls,
  cardCls,
} from "../../../components/ui/DashboardPrimitives";
import { ModalShell } from "../../../components/ui/ModalShell";
import {
  useAdminExpenseCategoriesQuery,
  useExpenseClaimMutations,
} from "../../../hooks/useReimbursementsQuery";
import { useHasPermission } from "../../../auth/useHasPermission";
import { PERMISSIONS } from "../../../auth/permissions";
import { ExpenseCategoryModel } from "../../../services/reimbursement.service";

export function ExpenseCategoriesAdminPage({
  toast,
}: {
  toast: (m: string) => void;
}) {
  const canManage = useHasPermission(PERMISSIONS.EXPENSES_MANAGE);

  const {
    data: categories = [],
    isLoading,
    isError,
    refetch,
  } = useAdminExpenseCategoriesQuery(false);
  const { createCategory, updateCategory } = useExpenseClaimMutations();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ExpenseCategoryModel | null>(
    null,
  );

  // Form State
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [maxLimit, setMaxLimit] = useState<string>("");
  const [requireReceipt, setRequireReceipt] = useState(true);
  const [isTaxable, setIsTaxable] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetForm = () => {
    setName("");
    setCode("");
    setDescription("");
    setMaxLimit("");
    setRequireReceipt(true);
    setIsTaxable(false);
    setIsActive(true);
    setValidationError(null);
  };

  const handleOpenCreate = () => {
    if (!canManage) {
      toast("You do not have permission to manage expense categories");
      return;
    }
    resetForm();
    setIsCreateOpen(true);
  };

  const handleOpenEdit = (cat: ExpenseCategoryModel) => {
    if (!canManage) {
      toast("You do not have permission to manage expense categories");
      return;
    }
    setEditingCategory(cat);
    setName(cat.name);
    setCode(cat.code);
    setDescription(cat.description || "");
    setMaxLimit(cat.maxLimit !== null && cat.maxLimit !== undefined ? String(cat.maxLimit) : "");
    setRequireReceipt(cat.requireReceipt ?? true);
    setIsTaxable(cat.isTaxable ?? false);
    setIsActive(cat.isActive ?? true);
    setValidationError(null);
  };

  const validateForm = (): boolean => {
    if (!name.trim()) {
      setValidationError("Category name is required.");
      return false;
    }
    if (!editingCategory && !code.trim()) {
      setValidationError("Category code is required.");
      return false;
    }
    if (!editingCategory && !/^[A-Za-z0-9_]+$/.test(code.trim())) {
      setValidationError("Category code must be alphanumeric (e.g. TRAVEL, MEALS_CLIENT).");
      return false;
    }
    if (maxLimit.trim() !== "") {
      const parsed = Number(maxLimit);
      if (isNaN(parsed) || parsed < 0) {
        setValidationError("Maximum limit must be a positive number.");
        return false;
      }
    }
    setValidationError(null);
    return true;
  };

  const handleSaveCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      await createCategory.mutateAsync({
        name: name.trim(),
        code: code.trim().toUpperCase(),
        description: description.trim() || undefined,
        maxLimit: maxLimit.trim() !== "" ? Number(maxLimit) : undefined,
        requireReceipt,
        isTaxable,
      });

      toast(`Expense category "${name.trim()}" created successfully!`);
      setIsCreateOpen(false);
      resetForm();
    } catch (err: any) {
      toast(err?.message || "Failed to create expense category");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCategory || !validateForm()) return;

    setIsSubmitting(true);
    try {
      await updateCategory.mutateAsync({
        id: editingCategory.id,
        data: {
          name: name.trim(),
          description: description.trim() || undefined,
          maxLimit: maxLimit.trim() !== "" ? Number(maxLimit) : undefined,
          requireReceipt,
          isTaxable,
          isActive,
        },
      });

      toast(`Expense category "${name.trim()}" updated successfully!`);
      setEditingCategory(null);
      resetForm();
    } catch (err: any) {
      toast(err?.message || "Failed to update expense category");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async (cat: ExpenseCategoryModel) => {
    if (!canManage) {
      toast("You do not have permission to manage expense categories");
      return;
    }
    const nextState = !cat.isActive;
    try {
      await updateCategory.mutateAsync({
        id: cat.id,
        data: { isActive: nextState },
      });
      toast(`Category "${cat.name}" ${nextState ? "activated" : "deactivated"} successfully`);
    } catch (err: any) {
      toast(err?.message || "Failed to update category status");
    }
  };

  if (!canManage) {
    return (
      <div className="p-8 text-center rounded-2xl border border-destructive/20 bg-destructive/5 space-y-3">
        <ShieldAlert className="h-8 w-8 text-destructive mx-auto" />
        <h2 className="text-lg font-bold text-destructive">Access Restricted</h2>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          You do not have permission to configure expense categories and reimbursement policies.
          Please contact your tenant administrator or HR manager.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Expense Categories & Policies</h1>
          <p className="text-sm text-muted-foreground">
            Configure tenant expense heads, policy limits, receipt requirements, and tax treatments.
          </p>
        </div>
        <Btn onClick={handleOpenCreate}>
          <Plus size={16} /> New Category
        </Btn>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          Loading expense categories from database...
        </div>
      )}

      {/* Error State */}
      {isError && (
        <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-center justify-between">
          <span>Failed to load expense categories. Please check network and permissions.</span>
          <Btn variant="outline" size="sm" onClick={() => refetch()}>
            Retry
          </Btn>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !isError && categories.length === 0 && (
        <div className="p-12 text-center rounded-2xl border border-dashed border-border bg-card/50 text-muted-foreground space-y-3">
          <Layers className="h-10 w-10 text-muted-foreground/40 mx-auto" />
          <h3 className="text-base font-semibold text-foreground">No Expense Categories Configured</h3>
          <p className="text-xs max-w-sm mx-auto">
            Your organization has not defined any reimbursement categories yet.
            Create categories so employees can submit travel, meal, or business expense claims.
          </p>
          <Btn onClick={handleOpenCreate}>
            <Plus size={16} /> Create First Category
          </Btn>
        </div>
      )}

      {/* Categories Table */}
      {!isLoading && !isError && categories.length > 0 && (
        <div className={cardCls + " !p-0 overflow-hidden"}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left text-xs uppercase text-muted-foreground">
                  <th className="px-6 py-4">Category Details</th>
                  <th className="px-6 py-4">Code</th>
                  <th className="px-6 py-4">Maximum Limit</th>
                  <th className="px-6 py-4">Proof Receipt</th>
                  <th className="px-6 py-4">Tax Treatment</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {categories.map((cat) => (
                  <tr
                    key={cat.id}
                    className={`hover:bg-muted/30 transition-colors ${
                      !cat.isActive ? "opacity-60 bg-muted/10" : ""
                    }`}
                  >
                    <td className="px-6 py-4">
                      <div className="font-bold text-foreground text-sm">{cat.name}</div>
                      {cat.description && (
                        <div className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                          {cat.description}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-mono text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground font-semibold">
                        {cat.code}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-medium text-foreground">
                      {cat.maxLimit ? (
                        <span className="font-mono text-xs">₹{cat.maxLimit.toLocaleString("en-IN")}</span>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">No Limit</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <Badge tone={cat.requireReceipt ? "sky" : "slate"}>
                        <Receipt size={12} className="mr-1" />
                        {cat.requireReceipt ? "Required" : "Optional"}
                      </Badge>
                    </td>
                    <td className="px-6 py-4">
                      <Badge tone={cat.isTaxable ? "amber" : "emerald"}>
                        <Coins size={12} className="mr-1" />
                        {cat.isTaxable ? "Taxable" : "Non-Taxable"}
                      </Badge>
                    </td>
                    <td className="px-6 py-4">
                      <Badge tone={cat.isActive ? "emerald" : "rose"}>
                        {cat.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <Btn
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenEdit(cat)}
                        className="h-8 px-2.5 text-xs"
                      >
                        <Edit2 size={13} className="mr-1" /> Edit
                      </Btn>
                      <Btn
                        variant="outline"
                        size="sm"
                        onClick={() => handleToggleActive(cat)}
                        className={`h-8 px-2.5 text-xs ${
                          cat.isActive
                            ? "hover:text-destructive hover:border-destructive"
                            : "hover:text-emerald-600 hover:border-emerald-600"
                        }`}
                      >
                        {cat.isActive ? (
                          <>
                            <XCircle size={13} className="mr-1" /> Deactivate
                          </>
                        ) : (
                          <>
                            <CheckCircle2 size={13} className="mr-1" /> Activate
                          </>
                        )}
                      </Btn>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {isCreateOpen && (
        <ModalShell
          title="Create Expense Category"
          onClose={() => {
            if (!isSubmitting) setIsCreateOpen(false);
          }}
        >
          <p className="text-xs text-muted-foreground -mt-2 mb-4">
            Define a new reimbursement head and policy rules for this organization.
          </p>
          <form onSubmit={handleSaveCreate} className="space-y-4">
            {validationError && (
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs">
                {validationError}
              </div>
            )}

            <Field label="Category Name *">
              <input
                type="text"
                placeholder="e.g. Travel & Conveyance, Client Entertainment"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={inputCls}
                disabled={isSubmitting}
                required
              />
            </Field>

            <Field label="Category Code * (Unique Identifier)">
              <input
                type="text"
                placeholder="e.g. TRAVEL, MEALS_CLIENT, OFFICE"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase().replace(/\s+/g, "_"))}
                className={inputCls + " font-mono uppercase"}
                disabled={isSubmitting}
                required
              />
            </Field>

            <Field label="Description & Policy Guidance (Optional)">
              <textarea
                placeholder="Specify which receipts and expenses are eligible under this category..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className={inputCls + " min-h-[70px]"}
                disabled={isSubmitting}
              />
            </Field>

            <Field label="Maximum Claim Limit per Item (₹)">
              <input
                type="number"
                placeholder="Leave blank for no upper cap"
                value={maxLimit}
                onChange={(e) => setMaxLimit(e.target.value)}
                className={inputCls}
                min={0}
                step="any"
                disabled={isSubmitting}
              />
            </Field>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <label className="flex items-center gap-3 p-3 rounded-xl border border-border bg-muted/20 cursor-pointer hover:bg-muted/40">
                <input
                  type="checkbox"
                  checked={requireReceipt}
                  onChange={(e) => setRequireReceipt(e.target.checked)}
                  className="rounded border-border h-4 w-4 text-primary"
                  disabled={isSubmitting}
                />
                <div className="text-xs">
                  <div className="font-semibold text-foreground">Require Receipt Document</div>
                  <div className="text-muted-foreground">Employees must attach a receipt proof</div>
                </div>
              </label>

              <label className="flex items-center gap-3 p-3 rounded-xl border border-border bg-muted/20 cursor-pointer hover:bg-muted/40">
                <input
                  type="checkbox"
                  checked={isTaxable}
                  onChange={(e) => setIsTaxable(e.target.checked)}
                  className="rounded border-border h-4 w-4 text-primary"
                  disabled={isSubmitting}
                />
                <div className="text-xs">
                  <div className="font-semibold text-foreground">Taxable Perquisite</div>
                  <div className="text-muted-foreground">Payouts subject to payroll tax deductions</div>
                </div>
              </label>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-border">
              <Btn
                type="button"
                variant="outline"
                onClick={() => setIsCreateOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Btn>
              <Btn type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 size={16} className="animate-spin mr-1" /> Creating...
                  </>
                ) : (
                  "Create Category"
                )}
              </Btn>
            </div>
          </form>
        </ModalShell>
      )}

      {/* Edit Modal */}
      {editingCategory && (
        <ModalShell
          title={`Edit Category: ${editingCategory.name}`}
          onClose={() => {
            if (!isSubmitting) setEditingCategory(null);
          }}
        >
          <p className="text-xs text-muted-foreground -mt-2 mb-4">
            Update policy limits, receipt requirements, and active status.
          </p>
          <form onSubmit={handleSaveEdit} className="space-y-4">
            {validationError && (
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs">
                {validationError}
              </div>
            )}

            <Field label="Category Name *">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={inputCls}
                disabled={isSubmitting}
                required
              />
            </Field>

            <Field label="Category Code (Immutable)">
              <input
                type="text"
                value={editingCategory.code}
                className={inputCls + " font-mono uppercase bg-muted cursor-not-allowed opacity-75"}
                disabled
              />
            </Field>

            <Field label="Description & Policy Guidance">
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className={inputCls + " min-h-[70px]"}
                disabled={isSubmitting}
              />
            </Field>

            <Field label="Maximum Claim Limit per Item (₹)">
              <input
                type="number"
                placeholder="Leave blank for no upper cap"
                value={maxLimit}
                onChange={(e) => setMaxLimit(e.target.value)}
                className={inputCls}
                min={0}
                step="any"
                disabled={isSubmitting}
              />
            </Field>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <label className="flex items-center gap-3 p-3 rounded-xl border border-border bg-muted/20 cursor-pointer hover:bg-muted/40">
                <input
                  type="checkbox"
                  checked={requireReceipt}
                  onChange={(e) => setRequireReceipt(e.target.checked)}
                  className="rounded border-border h-4 w-4 text-primary"
                  disabled={isSubmitting}
                />
                <div className="text-xs">
                  <div className="font-semibold text-foreground">Require Receipt Document</div>
                  <div className="text-muted-foreground">Employees must attach receipt proof</div>
                </div>
              </label>

              <label className="flex items-center gap-3 p-3 rounded-xl border border-border bg-muted/20 cursor-pointer hover:bg-muted/40">
                <input
                  type="checkbox"
                  checked={isTaxable}
                  onChange={(e) => setIsTaxable(e.target.checked)}
                  className="rounded border-border h-4 w-4 text-primary"
                  disabled={isSubmitting}
                />
                <div className="text-xs">
                  <div className="font-semibold text-foreground">Taxable Perquisite</div>
                  <div className="text-muted-foreground">Subject to payroll tax deductions</div>
                </div>
              </label>
            </div>

            <label className="flex items-center gap-3 p-3 rounded-xl border border-border bg-muted/20 cursor-pointer hover:bg-muted/40">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="rounded border-border h-4 w-4 text-primary"
                disabled={isSubmitting}
              />
              <div className="text-xs">
                <div className="font-semibold text-foreground">Active for Employee Claims</div>
                <div className="text-muted-foreground">
                  When inactive, existing claims remain intact but new claims cannot select this head
                </div>
              </div>
            </label>

            <div className="flex justify-end gap-3 pt-4 border-t border-border">
              <Btn
                type="button"
                variant="outline"
                onClick={() => setEditingCategory(null)}
                disabled={isSubmitting}
              >
                Cancel
              </Btn>
              <Btn type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 size={16} className="animate-spin mr-1" /> Saving...
                  </>
                ) : (
                  "Save Changes"
                )}
              </Btn>
            </div>
          </form>
        </ModalShell>
      )}
    </div>
  );
}

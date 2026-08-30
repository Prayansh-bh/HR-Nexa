import React, { useState } from "react";
import { Plus, Trash2, Edit3, Loader2 } from "lucide-react";
import { Field, Btn, Badge, inputCls, cardCls } from "../../../components/ui/DashboardPrimitives";
import { useLeaveTypesQuery, useLeaveMutations } from "../../../hooks/useLeavesQuery";
import { useHasPermission } from "../../../auth/useHasPermission";
import { PERMISSIONS } from "../../../auth/permissions";
import { useUIStore } from "../../../store";

export function LeaveConfigPage({ toast }: { toast: (m: string) => void }) {
  const canManage = useHasPermission(PERMISSIONS.LEAVES_POLICY_MANAGE);
  const { data: leaveTypes = [], isLoading, isError } = useLeaveTypesQuery();
  const { createLeaveType, updateLeaveType, deleteLeaveType } = useLeaveMutations();

  const [show, setShow] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [form, setForm] = useState({
    name: "",
    days: 12,
    accrualRate: 1.0,
    maxCap: 12,
    carryForward: false,
    tone: "indigo",
    accrualFrequency: "Monthly",
  });

  const resetForm = () => {
    setForm({
      name: "",
      days: 12,
      accrualRate: 1.0,
      maxCap: 12,
      carryForward: false,
      tone: "indigo",
      accrualFrequency: "Monthly",
    });
    setEditingId(null);
    setShow(false);
  };

  const handleOpenCreate = () => {
    if (!canManage) {
      toast("You do not have permission to manage leave policies");
      return;
    }
    resetForm();
    setShow(true);
  };

  const handleOpenEdit = (policy: any) => {
    if (!canManage) {
      toast("You do not have permission to manage leave policies");
      return;
    }
    setEditingId(policy.id);
    setForm({
      name: policy.name || "",
      days: policy.days ?? 12,
      accrualRate: policy.accrualRate ?? 1.0,
      maxCap: policy.maxCap ?? policy.days ?? 12,
      carryForward: Boolean(policy.carryForward),
      tone: policy.tone || "indigo",
      accrualFrequency: policy.accrualFrequency || "Monthly",
    });
    setShow(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManage) {
      toast("You do not have permission to manage leave policies");
      return;
    }
    if (!form.name.trim()) {
      toast("Policy name is required");
      return;
    }
    if (Number(form.days) <= 0) {
      toast("Annual entitlement days must be greater than zero");
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingId) {
        await updateLeaveType.mutateAsync({
          id: editingId,
          data: {
            name: form.name.trim(),
            days: Number(form.days),
            accrualRate: Number(form.accrualRate),
            maxCap: Number(form.maxCap),
            carryForward: Boolean(form.carryForward),
            tone: form.tone,
            accrualFrequency: form.accrualFrequency,
          },
        });
        toast(`Leave policy '${form.name}' updated successfully`);
      } else {
        await createLeaveType.mutateAsync({
          name: form.name.trim(),
          days: Number(form.days),
          accrualRate: Number(form.accrualRate),
          maxCap: Number(form.maxCap),
          carryForward: Boolean(form.carryForward),
          tone: form.tone,
          accrualFrequency: form.accrualFrequency,
        });
        toast(`Leave policy '${form.name}' created successfully`);
      }
      resetForm();
    } catch (err: any) {
      toast(err?.message || "Failed to save leave policy");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = (policy: any) => {
    if (!canManage) {
      toast("You do not have permission to manage leave policies");
      return;
    }
    useUIStore.getState().setConfirmState({
      open: true,
      title: "Delete Leave Policy",
      message: `Are you sure you want to delete leave policy '${policy.name}'? Active balances configured under this category will be affected.`,
      confirmText: "Delete Policy",
      cancelText: "Cancel",
      confirmVariant: "danger",
      onConfirm: async () => {
        try {
          await deleteLeaveType.mutateAsync(policy.id);
          toast(`Leave policy '${policy.name}' deleted successfully`);
        } catch (err: any) {
          toast(err?.message || "Failed to delete leave policy");
        }
      },
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Leave Policy Config</h1>
          <p className="text-sm text-muted-foreground">
            Configure database-backed annual leave entitlements, accrual rates, caps, and carryover parameters.
          </p>
        </div>
        {canManage && (
          <Btn onClick={handleOpenCreate}>
            <Plus size={16} /> Add Leave Policy
          </Btn>
        )}
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          Loading leave policies from database...
        </div>
      )}

      {isError && (
        <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm">
          Failed to load leave policies. Please check your credentials or refresh the page.
        </div>
      )}

      {!isLoading && !isError && leaveTypes.length === 0 && (
        <div className="p-8 text-center rounded-2xl border border-dashed border-border text-muted-foreground space-y-3">
          <p className="text-base font-semibold">No Leave Policies Configured</p>
          <p className="text-xs">Click "Add Leave Policy" to create your tenant's first leave rule.</p>
          {canManage && (
            <Btn onClick={handleOpenCreate} variant="outline" size="sm">
              <Plus size={14} /> Create Policy
            </Btn>
          )}
        </div>
      )}

      {!isLoading && !isError && leaveTypes.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {leaveTypes.map((p: any) => (
            <div key={p.id} className={cardCls + " space-y-4 relative group"}>
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-bold text-lg">{p.name}</h3>
                  <span className="text-xs text-muted-foreground">
                    {p.accrualFrequency || "Monthly"} Accrual
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Badge tone={p.tone || "indigo"}>{p.days} Days/Yr</Badge>
                  {canManage && (
                    <>
                      <button
                        onClick={() => handleOpenEdit(p)}
                        className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition"
                        title="Edit Policy"
                      >
                        <Edit3 size={14} />
                      </button>
                      <button
                        onClick={() => handleDelete(p)}
                        className="p-1 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition"
                        title="Delete Policy"
                      >
                        <Trash2 size={14} />
                      </button>
                    </>
                  )}
                </div>
              </div>
              <div className="space-y-2 text-sm border-t border-border pt-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Accrual Rate:</span>
                  <span className="font-semibold">{p.accrualRate ?? 1.0} days / month</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Max Cap:</span>
                  <span className="font-semibold">{p.maxCap ?? p.days} days</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Carry Forward:</span>
                  <span className="font-semibold">{p.carryForward ? "Yes" : "No"}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {show && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/60 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-lg font-bold mb-4">
              {editingId ? "Edit Leave Policy" : "New Leave Policy"}
            </h3>
            <form onSubmit={handleSave} className="space-y-4">
              <Field label="Policy Name">
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className={inputCls}
                  placeholder="e.g. Parental Leave"
                  required
                />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Annual Entitlement (Days)">
                  <input
                    type="number"
                    min="1"
                    value={form.days}
                    onChange={(e) => setForm({ ...form, days: Number(e.target.value) })}
                    className={inputCls}
                    required
                  />
                </Field>
                <Field label="Accrual Rate (Days/Mo)">
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={form.accrualRate}
                    onChange={(e) => setForm({ ...form, accrualRate: Number(e.target.value) })}
                    className={inputCls}
                    required
                  />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Max Cap Threshold">
                  <input
                    type="number"
                    min="0"
                    value={form.maxCap}
                    onChange={(e) => setForm({ ...form, maxCap: Number(e.target.value) })}
                    className={inputCls}
                    required
                  />
                </Field>
                <Field label="Accrual Frequency">
                  <select
                    value={form.accrualFrequency}
                    onChange={(e) => setForm({ ...form, accrualFrequency: e.target.value })}
                    className={inputCls}
                  >
                    <option value="Monthly">Monthly</option>
                    <option value="Quarterly">Quarterly</option>
                    <option value="Annual">Annual</option>
                  </select>
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Badge Color Theme">
                  <select
                    value={form.tone}
                    onChange={(e) => setForm({ ...form, tone: e.target.value })}
                    className={inputCls}
                  >
                    <option value="emerald">Emerald (Green)</option>
                    <option value="amber">Amber (Orange)</option>
                    <option value="indigo">Indigo (Blue)</option>
                    <option value="sky">Sky (Light Blue)</option>
                    <option value="rose">Rose (Red)</option>
                    <option value="slate">Slate (Gray)</option>
                  </select>
                </Field>
                <Field label="Carry Forward Cap">
                  <select
                    value={form.carryForward ? "Yes" : "No"}
                    onChange={(e) => setForm({ ...form, carryForward: e.target.value === "Yes" })}
                    className={inputCls}
                  >
                    <option value="No">No</option>
                    <option value="Yes">Yes</option>
                  </select>
                </Field>
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <Btn variant="outline" type="button" onClick={resetForm}>
                  Cancel
                </Btn>
                <Btn type="submit" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Saving...
                    </>
                  ) : (
                    "Save Policy"
                  )}
                </Btn>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
export default LeaveConfigPage;


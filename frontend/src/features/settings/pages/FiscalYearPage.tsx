import React, { useState } from "react";
import { Plus, Loader2, Lock, Edit3, Trash2 } from "lucide-react";
import { Field, Btn, Badge, inputCls, cardCls } from "../../../components/ui/DashboardPrimitives";
import { useFiscalYearsQuery, useFiscalYearMutations } from "../../../hooks/useFiscalYearsQuery";
import { useHasPermission } from "../../../auth/useHasPermission";
import { PERMISSIONS } from "../../../auth/permissions";
import { useUIStore } from "../../../store";

export function FiscalYearPage({ toast }: { toast: (m: string) => void }) {
  const canManage = useHasPermission(PERMISSIONS.FISCAL_YEAR_MANAGE) || useHasPermission(PERMISSIONS.SETTINGS_COMPANY_EDIT);
  const { data: fiscals = [], isLoading, isError } = useFiscalYearsQuery();
  const {
    createFiscalYear,
    updateFiscalYear,
    activateFiscalYear,
    closeFiscalYear,
    lockFiscalYear,
    deleteFiscalYear,
  } = useFiscalYearMutations();

  const [show, setShow] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({ name: "", start: "", end: "" });

  const resetForm = () => {
    setForm({ name: "", start: "", end: "" });
    setEditingId(null);
    setShow(false);
  };

  const handleOpenCreate = () => {
    if (!canManage) {
      toast("You do not have permission to manage fiscal years");
      return;
    }
    const currentYear = new Date().getFullYear();
    setForm({
      name: `FY ${currentYear}-${(currentYear + 1).toString().slice(-2)}`,
      start: `${currentYear}-04-01`,
      end: `${currentYear + 1}-03-31`,
    });
    setEditingId(null);
    setShow(true);
  };

  const handleOpenEdit = (fy: any) => {
    if (!canManage) {
      toast("You do not have permission to manage fiscal years");
      return;
    }
    if (fy.isLocked || fy.status === "CLOSED") {
      toast("Locked or Closed fiscal periods cannot be edited");
      return;
    }
    setEditingId(fy.id);
    setForm({
      name: fy.name,
      start: fy.startDate ? fy.startDate.slice(0, 10) : "",
      end: fy.endDate ? fy.endDate.slice(0, 10) : "",
    });
    setShow(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManage) {
      toast("You do not have permission to manage fiscal years");
      return;
    }
    if (!form.name.trim() || !form.start || !form.end) {
      toast("Please fill in all fiscal year fields");
      return;
    }
    if (new Date(form.end) <= new Date(form.start)) {
      toast("End date must be strictly after start date");
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingId) {
        await updateFiscalYear.mutateAsync({
          id: editingId,
          data: {
            name: form.name.trim(),
            startDate: form.start,
            endDate: form.end,
          },
        });
        toast(`Fiscal year '${form.name}' updated successfully`);
      } else {
        await createFiscalYear.mutateAsync({
          name: form.name.trim(),
          startDate: form.start,
          endDate: form.end,
        });
        toast(`Draft fiscal year '${form.name}' created successfully`);
      }
      resetForm();
    } catch (err: any) {
      toast(err?.message || "Failed to save fiscal year");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleActivate = (fy: any) => {
    if (!canManage) {
      toast("You do not have permission to activate fiscal years");
      return;
    }
    useUIStore.getState().setConfirmState({
      open: true,
      title: "Activate Operational Period",
      message: `Are you sure you want to activate '${fy.name}' as the active operational period? This will close any previous active period.`,
      confirmText: "Activate Period",
      cancelText: "Cancel",
      confirmVariant: "primary",
      onConfirm: async () => {
        try {
          await activateFiscalYear.mutateAsync(fy.id);
          toast(`Fiscal period '${fy.name}' is now ACTIVE`);
        } catch (err: any) {
          toast(err?.message || "Failed to activate fiscal year");
        }
      },
    });
  };

  const handleClose = (fy: any) => {
    if (!canManage) {
      toast("You do not have permission to close fiscal years");
      return;
    }
    useUIStore.getState().setConfirmState({
      open: true,
      title: "Finalize & Close Fiscal Year",
      message: `Are you sure you want to finalize and CLOSE fiscal year '${fy.name}'? Closed periods cannot be re-opened.`,
      confirmText: "Close Period",
      cancelText: "Cancel",
      confirmVariant: "warning",
      onConfirm: async () => {
        try {
          await closeFiscalYear.mutateAsync(fy.id);
          toast(`Fiscal period '${fy.name}' CLOSED`);
        } catch (err: any) {
          toast(err?.message || "Failed to close fiscal year");
        }
      },
    });
  };

  const handleLock = (fy: any) => {
    if (!canManage) {
      toast("You do not have permission to lock fiscal years");
      return;
    }
    useUIStore.getState().setConfirmState({
      open: true,
      title: "Lock Fiscal Period",
      message: `Are you sure you want to LOCK fiscal year '${fy.name}'? Locked periods prevent any further updates.`,
      confirmText: "Lock Period",
      cancelText: "Cancel",
      confirmVariant: "warning",
      onConfirm: async () => {
        try {
          await lockFiscalYear.mutateAsync(fy.id);
          toast(`Fiscal period '${fy.name}' LOCKED`);
        } catch (err: any) {
          toast(err?.message || "Failed to lock fiscal year");
        }
      },
    });
  };

  const handleDelete = (fy: any) => {
    if (!canManage) {
      toast("You do not have permission to delete fiscal years");
      return;
    }
    useUIStore.getState().setConfirmState({
      open: true,
      title: "Delete Draft Fiscal Year",
      message: `Are you sure you want to delete draft fiscal year '${fy.name}'? This action cannot be undone.`,
      confirmText: "Delete Draft",
      cancelText: "Cancel",
      confirmVariant: "danger",
      onConfirm: async () => {
        try {
          await deleteFiscalYear.mutateAsync(fy.id);
          toast(`Draft fiscal year '${fy.name}' deleted`);
        } catch (err: any) {
          toast(err?.message || "Failed to delete draft fiscal year");
        }
      },
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Fiscal Year Config</h1>
          <p className="text-sm text-muted-foreground">
            Configure database-backed financial periods, tax years, and lock protections.
          </p>
        </div>
        {canManage && (
          <Btn onClick={handleOpenCreate}>
            <Plus className="h-4 w-4" /> Create Period
          </Btn>
        )}
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          Loading fiscal years from database...
        </div>
      )}

      {isError && (
        <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm">
          Failed to load fiscal years. Please check your network or user authorization.
        </div>
      )}

      {!isLoading && !isError && fiscals.length === 0 && (
        <div className="p-8 text-center rounded-2xl border border-dashed border-border text-muted-foreground space-y-3">
          <p className="text-base font-semibold">No Fiscal Years Configured</p>
          <p className="text-xs">Click "Create Period" to set up your tenant's financial boundaries.</p>
          {canManage && (
            <Btn onClick={handleOpenCreate} variant="outline" size="sm">
              <Plus className="h-4 w-4" /> Create Period
            </Btn>
          )}
        </div>
      )}

      {!isLoading && !isError && fiscals.length > 0 && (
        <div className={cardCls + " !p-0 overflow-hidden"}>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left text-xs uppercase text-muted-foreground">
                <th className="px-6 py-4 font-semibold">Fiscal Identifier</th>
                <th className="px-6 py-4 font-semibold">Start Date</th>
                <th className="px-6 py-4 font-semibold">End Date</th>
                <th className="px-6 py-4 font-semibold">Status</th>
                <th className="px-6 py-4 font-semibold">Lock State</th>
                <th className="px-6 py-4 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {fiscals.map((f: any) => (
                <tr
                  key={f.id}
                  className="border-b border-border/60 hover:bg-muted/40 font-mono text-xs"
                >
                  <td className="px-6 py-4 font-sans font-bold text-sm text-foreground">{f.name}</td>
                  <td className="px-6 py-4 text-muted-foreground">
                    {f.startDate ? f.startDate.slice(0, 10) : ""}
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">
                    {f.endDate ? f.endDate.slice(0, 10) : ""}
                  </td>
                  <td className="px-6 py-4">
                    <Badge
                      tone={
                        f.status === "ACTIVE"
                          ? "emerald"
                          : f.status === "CLOSED"
                            ? "slate"
                            : "amber"
                      }
                    >
                      {f.status}
                    </Badge>
                  </td>
                  <td className="px-6 py-4">
                    {f.isLocked ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-destructive">
                        <Lock className="h-3.5 w-3.5" /> Locked
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        Unlocked
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right space-x-2">
                    {canManage && f.status === "DRAFT" && (
                      <>
                        <Btn size="sm" onClick={() => handleActivate(f)}>
                          Activate
                        </Btn>
                        <button
                          onClick={() => handleOpenEdit(f)}
                          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition inline-block align-middle"
                          title="Edit Period"
                        >
                          <Edit3 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(f)}
                          className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition inline-block align-middle"
                          title="Delete Period"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </>
                    )}

                    {canManage && f.status === "ACTIVE" && (
                      <>
                        <Btn size="sm" variant="outline" onClick={() => handleClose(f)}>
                          Close Period
                        </Btn>
                        {!f.isLocked && (
                          <Btn size="sm" variant="outline" onClick={() => handleLock(f)}>
                            <Lock className="h-3.5 w-3.5" /> Lock
                          </Btn>
                        )}
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {show && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/60 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-lg font-bold mb-4">
              {editingId ? "Edit Fiscal Period" : "Add Fiscal Period"}
            </h3>
            <form onSubmit={handleSave} className="space-y-4">
              <Field label="Year Identifier">
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className={inputCls}
                  placeholder="e.g. FY 2026-27"
                  required
                />
              </Field>
              <Field label="Start Date">
                <input
                  type="date"
                  value={form.start}
                  onChange={(e) => setForm({ ...form, start: e.target.value })}
                  className={inputCls}
                  required
                />
              </Field>
              <Field label="End Date">
                <input
                  type="date"
                  value={form.end}
                  onChange={(e) => setForm({ ...form, end: e.target.value })}
                  className={inputCls}
                  required
                />
              </Field>
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
                    "Save Period"
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


import React, { useState } from "react";
import { Plus, X } from "lucide-react";
import { Btn, Badge, cardCls } from "../../../components/ui/DashboardPrimitives";
import { useExitQueries } from "../hooks/useExitQuery";
import { format } from "date-fns";
import { ExitDetailPage } from "./ExitDetailPage";
import type { AuthUser } from "../../../types";

export function ExitListPage({ toast, user }: { toast: (m: string) => void; user: AuthUser }) {
  const { useExits, useAdvanceToChecklist, useSubmitResignation, useManagerApprove, useHrApprove } =
    useExitQueries();
  const { data: exitsData, isLoading } = useExits();
  const exits = Array.isArray(exitsData)
    ? exitsData
    : Array.isArray((exitsData as any)?.data)
      ? (exitsData as any).data
      : [];
  const advanceMutation = useAdvanceToChecklist();
  const submitMutation = useSubmitResignation();
  const managerApproveMutation = useManagerApprove();
  const hrApproveMutation = useHrApprove();

  const [showModal, setShowModal] = useState(false);
  const [approveModal, setApproveModal] = useState<{ id: string; type: "manager" | "hr" } | null>(
    null,
  );
  const [selectedExitId, setSelectedExitId] = useState<string | null>(null);
  const [approveForm, setApproveForm] = useState({ approvedLastWorkingDay: "", remarks: "" });

  const isManagerOrAbove = ["Manager", "HRAdmin", "CompanyOwner"].includes(user.role);
  const isHrOrAbove = ["HRAdmin", "CompanyOwner"].includes(user.role);

  const [form, setForm] = useState({
    reason: "",
    proposedLastWorkingDay: "",
    noticeBuyoutRequest: false,
    additionalComments: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.reason.trim()) {
      toast("Please provide a reason for resignation");
      return;
    }
    if (!form.proposedLastWorkingDay) {
      toast("Please select your proposed last working day");
      return;
    }

    const parsedDate = new Date(form.proposedLastWorkingDay);
    if (isNaN(parsedDate.getTime())) {
      toast("Invalid date selected for proposed last working day");
      return;
    }

    submitMutation.mutate(
      {
        reason: form.reason.trim(),
        proposedLastWorkingDay: parsedDate.toISOString(),
        noticeBuyoutRequest: Boolean(form.noticeBuyoutRequest),
        additionalComments: form.additionalComments || undefined,
      },
      {
        onSuccess: () => {
          toast("Resignation submitted successfully!");
          setShowModal(false);
          setForm({
            reason: "",
            proposedLastWorkingDay: "",
            noticeBuyoutRequest: false,
            additionalComments: "",
          });
        },
        onError: (err: any) => {
          const errMsg = err.response?.data?.message || err.message || "Failed to submit resignation";
          toast(`Error: ${Array.isArray(errMsg) ? errMsg.join(", ") : errMsg}`);
        },
      },
    );
  };

  const handleApprove = (e: React.FormEvent) => {
    e.preventDefault();
    if (!approveModal) return;

    const payload = {
      approvedLastWorkingDay: new Date(approveForm.approvedLastWorkingDay).toISOString(),
      remarks: approveForm.remarks,
    };

    const mut = approveModal.type === "manager" ? managerApproveMutation : hrApproveMutation;
    mut.mutate(
      { id: approveModal.id, data: payload },
      {
        onSuccess: () => {
          toast(`${approveModal.type === "manager" ? "Manager" : "HR"} approval successful!`);
          setApproveModal(null);
        },
        onError: (err: any) => {
          toast(`Error: ${err.response?.data?.message || err.message}`);
        },
      },
    );
  };

  if (isLoading) return <div>Loading exits...</div>;

  if (selectedExitId) {
    return <ExitDetailPage exitId={selectedExitId} onBack={() => setSelectedExitId(null)} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Exit Management</h1>
          <p className="text-sm text-muted-foreground">
            Manage employee resignations and offboarding checklists.
          </p>
        </div>
        {user.role === "Employee" && (
          <Btn onClick={() => setShowModal(true)}>
            <Plus size={16} /> Submit Resignation
          </Btn>
        )}
      </div>

      <div className={cardCls + " !p-0 overflow-hidden"}>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-left text-xs uppercase text-muted-foreground">
              <th className="px-6 py-4">Employee</th>
              <th className="px-6 py-4">LWD (Proposed)</th>
              <th className="px-6 py-4">Stage</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {exits?.map((e: any) => (
              <tr key={e.id} className="border-b border-border/60 hover:bg-muted/40">
                <td className="px-6 py-4 font-bold">
                  {e.employee?.name}
                  <div className="text-xs text-muted-foreground font-normal">
                    {e.employee?.department?.name || "N/A"}
                  </div>
                </td>
                <td className="px-6 py-4 text-muted-foreground">
                  {format(new Date(e.proposedLastWorkingDay), "MMM dd, yyyy")}
                </td>
                <td className="px-6 py-4">
                  <Badge tone="slate">{e.stage}</Badge>
                </td>
                <td className="px-6 py-4">
                  <Badge
                    tone={
                      e.status === "APPROVED" ? "green" : e.status === "PENDING" ? "amber" : "slate"
                    }
                  >
                    {e.status}
                  </Badge>
                </td>
                <td className="px-6 py-4 text-right flex justify-end gap-2">
                  {e.stage === "SUBMITTED" && isManagerOrAbove && (
                    <Btn
                      variant="outline"
                      size="sm"
                      onClick={() => setApproveModal({ id: e.id, type: "manager" })}
                    >
                      Manager Approve
                    </Btn>
                  )}
                  {e.stage === "MANAGER_APPROVED" && isHrOrAbove && (
                    <Btn
                      variant="outline"
                      size="sm"
                      onClick={() => setApproveModal({ id: e.id, type: "hr" })}
                    >
                      HR Approve
                    </Btn>
                  )}
                  {e.stage === "NOTICE_PERIOD" && isHrOrAbove && (
                    <Btn
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        advanceMutation.mutate(e.id, {
                          onSuccess: () => toast("Advanced to Checklist Stage"),
                        });
                      }}
                    >
                      Initiate Checklist
                    </Btn>
                  )}
                  <Btn variant="ghost" size="sm" onClick={() => setSelectedExitId(e.id)}>
                    View Details
                  </Btn>
                </td>
              </tr>
            ))}
            {exits?.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-muted-foreground">
                  No exit records found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-card w-full max-w-md rounded-xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-6 border-b border-border">
              <h2 className="text-xl font-semibold">Submit Resignation</h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Reason for Leaving</label>
                <select
                  className="w-full p-2 rounded-md border border-input bg-background"
                  value={form.reason}
                  onChange={(e) => setForm({ ...form, reason: e.target.value })}
                  required
                >
                  <option value="">Select a reason...</option>
                  <option value="Better Opportunity">Better Opportunity</option>
                  <option value="Higher Education">Higher Education</option>
                  <option value="Relocation">Relocation</option>
                  <option value="Health Reasons">Health Reasons</option>
                  <option value="Personal Reasons">Personal Reasons</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Proposed Last Working Day</label>
                <input
                  type="date"
                  className="w-full p-2 rounded-md border border-input bg-background"
                  value={form.proposedLastWorkingDay}
                  onChange={(e) => setForm({ ...form, proposedLastWorkingDay: e.target.value })}
                  required
                />
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="buyout"
                  className="rounded border-input text-primary focus:ring-primary"
                  checked={form.noticeBuyoutRequest}
                  onChange={(e) => setForm({ ...form, noticeBuyoutRequest: e.target.checked })}
                />
                <label htmlFor="buyout" className="text-sm font-medium">
                  Request Notice Period Buyout
                </label>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Additional Comments</label>
                <textarea
                  className="w-full p-2 rounded-md border border-input bg-background min-h-[100px]"
                  placeholder="Any extra details you'd like to share..."
                  value={form.additionalComments}
                  onChange={(e) => setForm({ ...form, additionalComments: e.target.value })}
                />
              </div>

              <div className="pt-4 flex justify-end gap-3">
                <Btn variant="outline" type="button" onClick={() => setShowModal(false)}>
                  Cancel
                </Btn>
                <Btn type="submit" disabled={submitMutation.isPending}>
                  {submitMutation.isPending ? "Submitting..." : "Confirm Submission"}
                </Btn>
              </div>
            </form>
          </div>
        </div>
      )}

      {approveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-card w-full max-w-md rounded-xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-6 border-b border-border">
              <h2 className="text-xl font-semibold">
                {approveModal.type === "manager" ? "Manager Approval" : "HR Approval"}
              </h2>
              <button
                onClick={() => setApproveModal(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleApprove} className="p-6 space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Approved Last Working Day</label>
                <input
                  type="date"
                  className="w-full p-2 rounded-md border border-input bg-background"
                  value={approveForm.approvedLastWorkingDay}
                  onChange={(e) =>
                    setApproveForm({ ...approveForm, approvedLastWorkingDay: e.target.value })
                  }
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Remarks / Comments</label>
                <textarea
                  className="w-full p-2 rounded-md border border-input bg-background min-h-[100px]"
                  placeholder="Approval notes..."
                  value={approveForm.remarks}
                  onChange={(e) => setApproveForm({ ...approveForm, remarks: e.target.value })}
                />
              </div>

              <div className="pt-4 flex justify-end gap-3">
                <Btn variant="outline" type="button" onClick={() => setApproveModal(null)}>
                  Cancel
                </Btn>
                <Btn
                  type="submit"
                  disabled={managerApproveMutation.isPending || hrApproveMutation.isPending}
                >
                  Approve Resignation
                </Btn>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

import React, { useState } from "react";
import { AlertCircle, CheckCircle, XCircle, Clock, Calendar, User, FileText, X } from "lucide-react";

interface AttendanceRegularizationReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  request: any | null;
  mode: "approve" | "reject";
  onApprove: (id: string, remark?: string) => Promise<void>;
  onReject: (id: string, remark: string) => Promise<void>;
  isSubmitting: boolean;
}

export function AttendanceRegularizationReviewModal({
  isOpen,
  onClose,
  request,
  mode,
  onApprove,
  onReject,
  isSubmitting,
}: AttendanceRegularizationReviewModalProps) {
  const [remark, setRemark] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  if (!isOpen || !request) return null;

  const isReject = mode === "reject";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    const trimmedRemark = remark.trim();

    if (isReject && !trimmedRemark) {
      setErrorMsg("A reviewer remark is required when rejecting a request.");
      return;
    }

    try {
      if (isReject) {
        await onReject(request.id, trimmedRemark);
      } else {
        await onApprove(request.id, trimmedRemark || undefined);
      }
      onClose();
    } catch (err: any) {
      const respMsg = err?.response?.data?.message;
      const display = Array.isArray(respMsg)
        ? respMsg.join(", ")
        : err?.message || `Failed to ${mode} regularization request`;
      setErrorMsg(display);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-card border border-border rounded-2xl shadow-2xl overflow-hidden space-y-0">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-5 border-b border-border bg-muted/30">
          <div className="flex items-center gap-2.5">
            <div
              className={`p-2 rounded-xl ${
                isReject
                  ? "bg-rose-500/10 text-rose-500"
                  : "bg-[color:var(--color-success)]/10 text-[color:var(--color-success)]"
              }`}
            >
              {isReject ? <XCircle className="h-5 w-5" /> : <CheckCircle className="h-5 w-5" />}
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">
                {isReject ? "Reject Regularization Request" : "Approve Regularization Request"}
              </h2>
              <p className="text-xs text-muted-foreground">
                Review employee submission details before confirming
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body / Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {errorMsg && (
            <div className="p-3.5 rounded-xl border border-rose-500/20 bg-rose-500/10 text-rose-600 dark:text-rose-400 text-xs font-medium flex items-start gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Request Details Summary Card */}
          <div className="p-4 rounded-xl bg-muted/40 border border-border text-xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-foreground">
                <User className="h-4 w-4 text-primary" />
                <span>{request.employee?.name || "Employee"}</span>
              </div>
              <span className="text-muted-foreground">{request.employee?.email}</span>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border/60">
              <div className="space-y-1">
                <span className="text-muted-foreground flex items-center gap-1 font-medium">
                  <Calendar className="h-3.5 w-3.5" /> Date:
                </span>
                <span className="font-bold text-foreground">
                  {request.attendance?.date || request.date || "–"}
                </span>
              </div>
              <div className="space-y-1">
                <span className="text-muted-foreground flex items-center gap-1 font-medium">
                  <Clock className="h-3.5 w-3.5" /> Requested Times:
                </span>
                <span className="font-bold text-primary">
                  {request.requestedInTime} – {request.requestedOutTime}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border/60 text-muted-foreground">
              <div>
                <span>Original In: </span>
                <span className="font-medium text-foreground">
                  {request.originalInTime || request.attendance?.inTime || "–"}
                </span>
              </div>
              <div>
                <span>Original Out: </span>
                <span className="font-medium text-foreground">
                  {request.originalOutTime || request.attendance?.outTime || "–"}
                </span>
              </div>
            </div>

            <div className="pt-2 border-t border-border/60 space-y-1">
              <span className="text-muted-foreground flex items-center gap-1 font-medium">
                <FileText className="h-3.5 w-3.5" /> Employee Reason:
              </span>
              <p className="text-foreground bg-card p-2.5 rounded-lg border border-border italic">
                "{request.reason}"
              </p>
            </div>
          </div>

          {/* Remark Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              Reviewer Remark {isReject && <span className="text-rose-500">*</span>}
            </label>
            <textarea
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              placeholder={
                isReject
                  ? "Specify the reason for rejection (e.g., unverified absence, missing proof)..."
                  : "Optional approval note..."
              }
              rows={3}
              maxLength={250}
              required={isReject}
              className="w-full p-3 text-xs rounded-xl border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition resize-none"
            />
          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl border border-border text-xs font-semibold text-muted-foreground hover:bg-muted/40 transition disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className={`px-4 py-2 rounded-xl text-xs font-semibold text-white transition hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed ${
                isReject ? "bg-rose-600 hover:bg-rose-700" : "bg-[color:var(--color-success)] hover:brightness-110"
              }`}
            >
              {isSubmitting
                ? "Processing..."
                : isReject
                  ? "Confirm Rejection"
                  : "Confirm Approval"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

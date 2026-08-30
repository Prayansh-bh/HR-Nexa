import React, { useState, useEffect } from "react";
import { AlertCircle, Clock, Calendar, FileText, X } from "lucide-react";

interface AttendanceRegularizationModalProps {
  isOpen: boolean;
  onClose: () => void;
  record: any | null;
  onSubmit: (payload: {
    attendanceId: string;
    requestedInTime: string;
    requestedOutTime: string;
    reason: string;
  }) => Promise<void>;
  isSubmitting: boolean;
}

export function AttendanceRegularizationModal({
  isOpen,
  onClose,
  record,
  onSubmit,
  isSubmitting,
}: AttendanceRegularizationModalProps) {
  const [requestedInTime, setRequestedInTime] = useState("");
  const [requestedOutTime, setRequestedOutTime] = useState("");
  const [reason, setReason] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (record) {
      setRequestedInTime(record.inTime || record.checkIn || "09:00");
      setRequestedOutTime(record.outTime || record.checkOut || "17:00");
      setReason("");
      setErrorMsg("");
    }
  }, [record]);

  if (!isOpen || !record) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    const trimmedReason = reason.trim();
    if (!trimmedReason) {
      setErrorMsg("A reason is required to submit a regularization request.");
      return;
    }

    if (requestedOutTime <= requestedInTime) {
      setErrorMsg("Requested check-out time must be later than check-in time.");
      return;
    }

    try {
      await onSubmit({
        attendanceId: record.id,
        requestedInTime,
        requestedOutTime,
        reason: trimmedReason,
      });
      onClose();
    } catch (err: any) {
      const respMsg = err?.response?.data?.message;
      const display = Array.isArray(respMsg)
        ? respMsg.join(", ")
        : err?.message || "Failed to submit regularization request";
      setErrorMsg(display);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-card border border-border rounded-2xl shadow-2xl overflow-hidden space-y-0">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-5 border-b border-border bg-muted/30">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">Request Attendance Regularization</h2>
              <p className="text-xs text-muted-foreground">
                Submit time correction for attendance record on {record.date}
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

          {/* Original Record Summary Card */}
          <div className="p-4 rounded-xl bg-muted/40 border border-border text-xs space-y-2">
            <div className="flex items-center justify-between font-bold text-foreground">
              <span className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-primary" /> Date: {record.date}
              </span>
              <span className="text-muted-foreground">Current Status: {record.status}</span>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/60 text-muted-foreground">
              <div>
                <span>Original In: </span>
                <span className="font-semibold text-foreground">{record.inTime || record.checkIn || "–"}</span>
              </div>
              <div>
                <span>Original Out: </span>
                <span className="font-semibold text-foreground">{record.outTime || record.checkOut || "–"}</span>
              </div>
            </div>
          </div>

          {/* Time Inputs */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                Requested Check-in Time <span className="text-rose-500">*</span>
              </label>
              <input
                type="time"
                value={requestedInTime}
                onChange={(e) => setRequestedInTime(e.target.value)}
                required
                className="w-full p-2.5 text-xs rounded-xl border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                Requested Check-out Time <span className="text-rose-500">*</span>
              </label>
              <input
                type="time"
                value={requestedOutTime}
                onChange={(e) => setRequestedOutTime(e.target.value)}
                required
                className="w-full p-2.5 text-xs rounded-xl border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition"
              />
            </div>
          </div>

          {/* Reason Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground flex items-center gap-1">
              <FileText className="h-3.5 w-3.5 text-primary" />
              Reason for Correction <span className="text-rose-500">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Provide a clear explanation for the requested time adjustment (e.g. system issue, offsite client meeting)..."
              rows={3}
              maxLength={250}
              required
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
              className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold transition hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
            >
              {isSubmitting ? "Submitting..." : "Submit Request"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

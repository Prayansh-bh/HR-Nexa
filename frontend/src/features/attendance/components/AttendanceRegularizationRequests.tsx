import React, { useState, useMemo, useEffect } from "react";
import {
  useRegularizationRequestsQuery,
  useAttendanceMutations,
} from "../../../hooks/useAttendanceQuery";
import { AttendanceRegularizationReviewModal } from "./AttendanceRegularizationReviewModal";
import { Calendar, Clock, User, Check, X, FileText, Filter, AlertCircle } from "lucide-react";
import { PaginationControls } from "../../../components/ui/PaginationControls";

interface AttendanceRegularizationRequestsProps {
  toast: (m: string) => void;
  canVerify: boolean;
}

const cardCls =
  "rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)] transition hover:shadow-[var(--shadow-elevated)]";

function Btn({
  children,
  onClick,
  variant = "primary",
  size = "md",
  className = "",
  type = "button",
  disabled,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "ghost" | "outline" | "danger" | "success";
  size?: "sm" | "md";
  className?: string;
  type?: "button" | "submit";
  disabled?: boolean;
}) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition duration-200 hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0";
  const sizes = { sm: "px-3 py-1.5 text-xs", md: "px-4 py-2 text-sm" };
  const variants = {
    primary: "btn-gradient hover:brightness-110",
    success: "bg-[color:var(--color-success)] text-white shadow-md hover:brightness-110",
    ghost: "text-muted-foreground hover:bg-muted hover:text-foreground",
    outline: "border border-border bg-card hover:border-primary hover:text-primary",
    danger: "bg-destructive text-destructive-foreground shadow-md hover:brightness-110",
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

function Badge({ children, tone = "slate" }: { children: React.ReactNode; tone?: string }) {
  const tones: Record<string, string> = {
    slate: "bg-muted text-muted-foreground",
    green: "bg-[color:var(--color-success)]/15 text-[color:var(--color-success)]",
    amber: "bg-[color:var(--color-warning)]/15 text-[color:var(--color-warning)]",
    rose: "bg-destructive/15 text-destructive",
    indigo: "bg-primary/15 text-primary",
    sky: "bg-[color:var(--color-info)]/15 text-[color:var(--color-info)]",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${tones[tone] || tones.slate}`}
    >
      {children}
    </span>
  );
}

export function AttendanceRegularizationRequests({
  toast,
  canVerify,
}: AttendanceRegularizationRequestsProps) {
  const [statusFilter, setStatusFilter] = useState<string>("PENDING");
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);

  const [reviewModalState, setReviewModalState] = useState<{
    isOpen: boolean;
    request: any | null;
    mode: "approve" | "reject";
  }>({
    isOpen: false,
    request: null,
    mode: "approve",
  });

  const {
    requests = [],
    total = 0,
    totalPages = 0,
    isLoading,
  } = useRegularizationRequestsQuery({
    status: statusFilter === "ALL" ? undefined : statusFilter,
    page,
    limit: pageSize,
  });

  useEffect(() => {
    if (page > totalPages && totalPages > 0) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const { approveRegularizationRequest, rejectRegularizationRequest } = useAttendanceMutations();

  const handleApprove = async (id: string, reviewerRemark?: string) => {
    try {
      await approveRegularizationRequest.mutateAsync({ id, reviewerRemark });
      toast("Attendance regularization request approved successfully.");
    } catch (err: any) {
      const status = err?.response?.status;
      const msg = err?.response?.data?.message;
      const displayMsg = Array.isArray(msg) ? msg.join(", ") : msg;
      if (status === 403) {
        toast(displayMsg || "Self-approval is prohibited or authorization denied.");
      } else if (status === 400) {
        toast(displayMsg || "Request has already been processed.");
      } else if (status === 404) {
        toast(displayMsg || "Request or attendance record not found.");
      } else {
        toast(displayMsg || "Failed to approve regularization request.");
      }
      throw err;
    }
  };

  const handleReject = async (id: string, reviewerRemark: string) => {
    try {
      await rejectRegularizationRequest.mutateAsync({ id, reviewerRemark });
      toast("Attendance regularization request rejected.");
    } catch (err: any) {
      const status = err?.response?.status;
      const msg = err?.response?.data?.message;
      const displayMsg = Array.isArray(msg) ? msg.join(", ") : msg;
      if (status === 403) {
        toast(displayMsg || "Self-review is prohibited or authorization denied.");
      } else if (status === 400) {
        toast(displayMsg || "Reviewer remark is required when rejecting.");
      } else if (status === 404) {
        toast(displayMsg || "Request not found.");
      } else {
        toast(displayMsg || "Failed to reject regularization request.");
      }
      throw err;
    }
  };

  return (
    <div className="space-y-4">
      {/* Filter Tabs Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-1.5 bg-muted/40 rounded-2xl border border-border">
        <div className="flex items-center gap-1">
          {["PENDING", "APPROVED", "REJECTED", "ALL"].map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => {
                setStatusFilter(st);
                setPage(1);
              }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition ${
                statusFilter === st
                  ? "bg-card text-foreground shadow-sm border border-border"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
              }`}
            >
              {st === "PENDING"
                ? "Pending Requests"
                : st === "APPROVED"
                  ? "Approved"
                  : st === "REJECTED"
                    ? "Rejected"
                    : "All Requests"}
            </button>
          ))}
        </div>
        <div className="text-xs text-muted-foreground px-3 flex items-center gap-1.5 font-medium">
          <Filter className="h-3.5 w-3.5" />
          <span>Showing {requests.length} of {total} request(s)</span>
        </div>
      </div>

      {/* Requests List */}
      {isLoading ? (
        <div className={cardCls + " text-center py-12 text-muted-foreground animate-pulse"}>
          Loading regularization requests...
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((r: any) => {
            const isPending = r.status === "PENDING";
            const dateStr = r.attendance?.date || r.date || "–";

            return (
              <div
                key={r.id}
                className={cardCls + " flex flex-col md:flex-row justify-between items-start md:items-center gap-4"}
              >
                <div className="space-y-2 max-w-2xl">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-base text-foreground flex items-center gap-1.5">
                      <User className="h-4 w-4 text-primary" />
                      {r.employee?.name || "Employee"}
                    </span>
                    <span className="text-xs text-muted-foreground">({r.employee?.email})</span>
                    <Badge
                      tone={
                        r.status === "APPROVED"
                          ? "green"
                          : r.status === "PENDING"
                            ? "amber"
                            : "rose"
                      }
                    >
                      {r.status === "APPROVED"
                        ? "Approved"
                        : r.status === "PENDING"
                          ? "Pending Review"
                          : "Rejected"}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1 font-medium text-foreground">
                      <Calendar className="h-3.5 w-3.5 text-primary" />
                      <span>Date: {dateStr}</span>
                    </div>
                    <div className="flex items-center gap-1 font-medium text-foreground">
                      <Clock className="h-3.5 w-3.5 text-primary" />
                      <span>
                        Requested: <strong className="text-primary">{r.requestedInTime} – {r.requestedOutTime}</strong>
                      </span>
                    </div>
                    <div>
                      <span>Original In: {r.originalInTime || r.attendance?.inTime || "–"}</span>
                    </div>
                    <div>
                      <span>Original Out: {r.originalOutTime || r.attendance?.outTime || "–"}</span>
                    </div>
                  </div>

                  {r.reason && (
                    <div className="text-xs text-foreground bg-muted/30 p-2.5 rounded-xl border border-border/80">
                      <span className="font-semibold text-muted-foreground">Reason: </span>
                      <span className="italic">"{r.reason}"</span>
                    </div>
                  )}

                  {r.reviewerRemark && (
                    <div className="text-xs text-rose-600 dark:text-rose-400 font-medium">
                      <span>Reviewer Remark ({r.reviewer?.name || "Reviewer"}): </span>
                      <span>"{r.reviewerRemark}"</span>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                  {isPending && canVerify ? (
                    <>
                      <Btn
                        variant="outline"
                        size="sm"
                        disabled={approveRegularizationRequest.isPending || rejectRegularizationRequest.isPending}
                        onClick={() =>
                          setReviewModalState({
                            isOpen: true,
                            request: r,
                            mode: "reject",
                          })
                        }
                      >
                        <X className="h-3.5 w-3.5 text-rose-500" />
                        Reject
                      </Btn>
                      <Btn
                        variant="success"
                        size="sm"
                        disabled={approveRegularizationRequest.isPending || rejectRegularizationRequest.isPending}
                        onClick={() =>
                          setReviewModalState({
                            isOpen: true,
                            request: r,
                            mode: "approve",
                          })
                        }
                      >
                        <Check className="h-3.5 w-3.5" />
                        Approve
                      </Btn>
                    </>
                  ) : !isPending ? (
                    <div className="text-xs text-muted-foreground italic font-medium">
                      Processed on {r.reviewedAt ? new Date(r.reviewedAt).toLocaleDateString() : "–"}
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}

          {requests.length === 0 && (
            <div className={cardCls + " text-center py-12 text-muted-foreground"}>
              No regularization requests found for status "{statusFilter}".
            </div>
          )}

          {requests.length > 0 && (
            <PaginationControls
              currentPage={page}
              totalPages={totalPages}
              totalItems={total}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={(newSize) => {
                setPageSize(newSize);
                setPage(1);
              }}
            />
          )}
        </div>
      )}

      {/* Review Modal */}
      <AttendanceRegularizationReviewModal
        isOpen={reviewModalState.isOpen}
        onClose={() => setReviewModalState({ isOpen: false, request: null, mode: "approve" })}
        request={reviewModalState.request}
        mode={reviewModalState.mode}
        onApprove={handleApprove}
        onReject={handleReject}
        isSubmitting={approveRegularizationRequest.isPending || rejectRegularizationRequest.isPending}
      />
    </div>
  );
}

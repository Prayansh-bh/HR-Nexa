import React, { useState, useEffect } from "react";
import { Btn, Badge, cardCls } from "../../../components/ui/DashboardPrimitives";
import { useLeavesQuery, useLeaveMutations } from "../../../hooks/useLeavesQuery";
import { useAuthStore } from "../../../store/authStore";
import { hasPermission, PERMISSIONS } from "../../../auth";
import { AttendanceRegularizationRequests } from "../../attendance/components/AttendanceRegularizationRequests";
import { PaginationControls } from "../../../components/ui/PaginationControls";
import { Clock, CalendarDays, Filter } from "lucide-react";

export function ManagerApprovalsPage({ toast }: { toast: (m: string) => void }) {
  const user = useAuthStore((s) => s.user);

  const canApproveLeave = hasPermission(user, PERMISSIONS.LEAVES_REQUESTS_APPROVE);
  const canVerifyAttendance = hasPermission(user, PERMISSIONS.EMPLOYEES_ATTENDANCE_VERIFY);
  const canViewAttendance = hasPermission(user, PERMISSIONS.EMPLOYEES_ATTENDANCE_VIEW);

  const [activeTab, setActiveTab] = useState<"leaves" | "attendance">(() => {
    if (canApproveLeave) return "leaves";
    if (canVerifyAttendance || canViewAttendance) return "attendance";
    return "leaves";
  });

  const [leaveStatusFilter, setLeaveStatusFilter] = useState<"PENDING" | "APPROVED" | "REJECTED" | "ALL">("PENDING");
  const [leavePage, setLeavePage] = useState<number>(1);
  const [leavePageSize, setLeavePageSize] = useState<number>(25);

  // Query backend directly for status-filtered leave requests
  const {
    leaves = [],
    total: leaveTotal = 0,
    totalPages: leaveTotalPages = 0,
    isLoading: isLeavesLoading,
  } = useLeavesQuery({
    status: leaveStatusFilter === "ALL" ? undefined : leaveStatusFilter,
    page: leavePage,
    limit: leavePageSize,
  });

  useEffect(() => {
    if (leavePage > leaveTotalPages && leaveTotalPages > 0) {
      setLeavePage(leaveTotalPages);
    }
  }, [leavePage, leaveTotalPages]);

  const { updateLeaveStatus } = useLeaveMutations();

  const actOnLeave = async (id: string, decision: "Approved" | "Rejected") => {
    try {
      await updateLeaveStatus.mutateAsync({ id, status: decision });
      toast(`Leave request ${decision.toLowerCase()} successfully`);
    } catch (err: any) {
      toast(`Failed to update leave request: ${err?.message || "Error occurred"}`);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Approvals Center</h1>
        <p className="text-sm text-muted-foreground">
          Review and process pending leave and attendance regularization tickets for team members.
        </p>
      </div>

      {/* Main Tab Navigation */}
      <div className="flex items-center gap-2 border-b border-border pb-3">
        {canApproveLeave && (
          <button
            type="button"
            onClick={() => setActiveTab("leaves")}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl transition ${
              activeTab === "leaves"
                ? "bg-primary text-primary-foreground shadow-md"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <CalendarDays className="h-4 w-4" />
            <span>Leave Requests</span>
            {leaveTotal > 0 && (
              <span className="px-2 py-0.5 text-xs rounded-full bg-primary-foreground/20 text-current">
                {leaveTotal}
              </span>
            )}
          </button>
        )}

        {(canVerifyAttendance || canViewAttendance) && (
          <button
            type="button"
            onClick={() => setActiveTab("attendance")}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl transition ${
              activeTab === "attendance"
                ? "bg-primary text-primary-foreground shadow-md"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <Clock className="h-4 w-4" />
            <span>Attendance Regularization</span>
          </button>
        )}
      </div>

      {/* Tab 1: Leave Approvals */}
      {activeTab === "leaves" && canApproveLeave && (
        <div className="space-y-4">
          {/* Sub-filter bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-1.5 bg-muted/40 rounded-2xl border border-border">
            <div className="flex items-center gap-1">
              {(["PENDING", "APPROVED", "REJECTED", "ALL"] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  aria-label={
                    st === "PENDING"
                      ? "Filter Pending"
                      : st === "APPROVED"
                        ? "Filter Granted"
                        : st === "REJECTED"
                          ? "Filter Declined"
                          : "Filter All"
                  }
                  onClick={() => {
                    setLeaveStatusFilter(st);
                    setLeavePage(1);
                  }}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition ${
                    leaveStatusFilter === st
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
              <span>Showing {leaves.length} of {leaveTotal} request(s)</span>
            </div>
          </div>

          {isLeavesLoading ? (
            <div className={cardCls + " text-center py-12 text-muted-foreground animate-pulse"}>
              Loading leave requests...
            </div>
          ) : (
            <div className="space-y-3">
              {leaves.map((l) => {
                const rawStatus = (l.status || "").toUpperCase();
                const isPending = rawStatus === "PENDING";
                const tone =
                  rawStatus === "APPROVED"
                    ? "green"
                    : rawStatus === "REJECTED"
                      ? "rose"
                      : "amber";

                return (
                  <div key={l.id} className={cardCls + " flex justify-between items-start"}>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-base">{l.type} Leave Request</span>
                        <Badge tone={tone}>{l.status}</Badge>
                      </div>
                      <p className="text-sm mt-2 text-foreground font-semibold">
                        {l.employee} — {l.days} Day(s) ({l.from} to {l.to})
                      </p>
                      <p className="text-xs mt-1 text-muted-foreground">Reason: {l.reason}</p>
                    </div>
                    {isPending && (
                      <div className="flex gap-2">
                        <Btn
                          variant="outline"
                          size="sm"
                          disabled={updateLeaveStatus.isPending}
                          onClick={() => actOnLeave(l.id, "Rejected")}
                        >
                          Reject
                        </Btn>
                        <Btn
                          variant="success"
                          size="sm"
                          disabled={updateLeaveStatus.isPending}
                          onClick={() => actOnLeave(l.id, "Approved")}
                        >
                          Approve
                        </Btn>
                      </div>
                    )}
                  </div>
                );
              })}
              {leaves.length === 0 && (
                <div className={cardCls + " text-center py-12 text-muted-foreground"}>
                  {leaveStatusFilter === "PENDING"
                    ? "No pending leave requests."
                    : `No ${leaveStatusFilter.toLowerCase()} leave requests found.`}
                </div>
              )}
              {leaves.length > 0 && (
                <div className="mt-4">
                  <PaginationControls
                    currentPage={leavePage}
                    totalPages={leaveTotalPages}
                    totalItems={leaveTotal}
                    pageSize={leavePageSize}
                    onPageChange={setLeavePage}
                    onPageSizeChange={(newSize) => {
                      setLeavePageSize(newSize);
                      setLeavePage(1);
                    }}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Attendance Regularization Approvals */}
      {activeTab === "attendance" && (canVerifyAttendance || canViewAttendance) && (
        <AttendanceRegularizationRequests
          toast={toast}
          canVerify={canVerifyAttendance}
        />
      )}
    </div>
  );
}

export default ManagerApprovalsPage;

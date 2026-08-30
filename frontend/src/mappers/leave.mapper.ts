import type { LeaveRequest, RawLeaveRequestApi } from "../types";

export function mapApiLeaveToModel(l: RawLeaveRequestApi | any): LeaveRequest {
  const rawStatus = l?.status || "PENDING";
  const formattedStatus = (rawStatus.charAt(0).toUpperCase() + rawStatus.slice(1).toLowerCase()) as
    | "Pending"
    | "Approved"
    | "Rejected";

  return {
    id: l?.id,
    employee: l?.employee?.name || l?.employeeName || "Unknown",
    type: l?.type || "General",
    from: l?.from || "",
    to: l?.to || "",
    days: Number(l?.days) || 0,
    reason: l?.reason || "",
    status: formattedStatus,
    department: l?.department || l?.employee?.departmentName || "",
  };
}

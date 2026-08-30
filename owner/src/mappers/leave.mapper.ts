import type { LeaveRequest } from "../types";

export function mapApiLeaveToModel(l: any): LeaveRequest {
  const rawStatus = l.status || "PENDING";
  const formattedStatus = rawStatus.charAt(0).toUpperCase() + rawStatus.slice(1).toLowerCase();

  return {
    id: l.id,
    employee: l.employee?.name || l.employeeName || "Unknown",
    type: l.type,
    from: l.from,
    to: l.to,
    days: l.days,
    reason: l.reason,
    status: formattedStatus,
    department: l.department || l.employee?.departmentName || "",
  };
}

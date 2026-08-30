export type LeaveRequest = {
  id: string;
  employeeId: string;
  type: string;
  from: string;
  to: string;
  days: number;
  reason: string;
  status: "Pending" | "Approved" | "Rejected";
  department?: string;
};

export type LeaveQuota = {
  id: string;
  employeeId: string;
  leaveType: string;
  totalDays: number;
  usedDays: number;
};

export type CreateLeavePayload = {
  employeeId: string;
  type: string;
  from: string;
  to: string;
  days: number;
  reason: string;
  department?: string;
};

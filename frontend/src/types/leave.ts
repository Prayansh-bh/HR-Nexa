import { BadgeTone } from "./auth";

export type LeaveRequest = {
  id: string;
  employee: string;
  type: string;
  from: string;
  to: string;
  days: number;
  reason: string;
  status: "Pending" | "Approved" | "Rejected";
  department?: string;
};

export interface RawLeaveRequestApi {
  id: string;
  employeeId?: string;
  type: string;
  from: string;
  to: string;
  days: number;
  reason: string;
  status: string;
  employee?: {
    id?: string;
    name?: string;
    departmentName?: string;
  };
  employeeName?: string;
  department?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface PaginatedLeaveResponse {
  data: RawLeaveRequestApi[];
  total: number;
  page: number;
  limit: number;
  totalPages?: number;
}

export type LeaveType = {
  name: string;
  days: number;
  tone: BadgeTone;
};

export type Holiday = {
  id?: string;
  date: string;
  occasion: string;
  type: string;
  d?: string;
  o?: string;
  t?: string;
};

export type CalendarEvent = {
  id?: string;
  title: string;
  date: string;
  type: "leave" | "holiday" | "meeting" | "event";
};

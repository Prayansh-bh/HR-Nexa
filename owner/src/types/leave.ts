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

export type LeaveType = {
  name: string;
  days: number;
  tone: BadgeTone;
};

export type Holiday = {
  d: string;
  o: string;
  t: string;
};

export type CalendarEvent = {
  id?: string;
  title: string;
  date: string;
  type: "leave" | "holiday" | "meeting" | "event";
};

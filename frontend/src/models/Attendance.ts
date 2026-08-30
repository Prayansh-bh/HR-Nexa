export type { Device, Zone } from "../types/attendance";

export type AttendanceRecord = {
  id: string;
  employeeId: string;
  employeeName: string;
  date: string;
  checkIn: string;
  checkOut: string;
  status: string;
  verificationType: string;
  lateCheckIn: boolean;
  remarks?: string;
  source?: string;
};

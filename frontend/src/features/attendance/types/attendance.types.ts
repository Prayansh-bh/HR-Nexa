export type AttendanceRecord = {
  id: string;
  employeeId: string;
  date: string;
  inTime?: string;
  outTime?: string;
  status: "Present" | "On Leave" | "Half Day" | "Absent" | "Late";
  remarks?: string;
  ipAddress?: string;
  deviceId?: string;
  latitude?: string;
  longitude?: string;
  verified: boolean;
};

export type ClockPayload = {
  employeeId: string;
  inTime?: string;
  outTime?: string;
  status: string;
  remarks?: string;
};

export type RegularizePayload = {
  inTime?: string;
  outTime?: string;
  remarks?: string;
  status?: string;
};

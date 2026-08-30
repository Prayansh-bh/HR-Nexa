export type Device = {
  id: string;
  name: string;
  ip: string;
  status: "Online" | "Offline";
  last: string;
};

export type Zone = {
  name: string;
  radius: string;
  lat: string;
  employees: number;
};

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  employeeName?: string;
  date: string;
  inTime?: string;
  outTime?: string;
  status: string;
  remarks?: string;
  verified?: boolean;
  checkIn?: string;
  checkOut?: string;
  verificationType?: string;
  lateCheckIn?: boolean;
}

export interface ClockInOutPayload {
  employeeId?: string;
  date: string;
  inTime?: string;
  outTime?: string;
  ipAddress?: string;
  deviceId?: string;
  latitude?: string;
  longitude?: string;
  remarks?: string;
}


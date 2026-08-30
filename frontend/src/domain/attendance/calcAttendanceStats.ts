import type { Employee } from "../../types/employee";
import { getBusinessDateString } from "../../utils/date.utils";

export type AttendanceStats = {
  presentCount: number;
  absentCount: number;
  halfDayCount: number;
  onLeaveCount: number;
  lateCount: number;
  totalEmployees: number;
};

export function calcAttendanceStats(
  employees: Employee[],
  attendanceRecords: any[] = [],
  dateStr?: string,
): AttendanceStats {
  const today = dateStr || getBusinessDateString();
  const isSunday = new Date(today).getDay() === 0;

  let presentCount = 0;
  let absentCount = 0;
  let halfDayCount = 0;
  let onLeaveCount = 0;
  let lateCount = 0;

  employees.forEach((emp) => {
    const record = attendanceRecords.find((r) => r.employeeId === emp.id && r.date === today);
    if (record) {
      if (record.status === "Present" || record.status === "Late" || record.status === "Half Day") {
        presentCount++;
      }
      if (record.status === "Absent") absentCount++;
      else if (record.status === "On Leave") onLeaveCount++;
      else if (record.status === "Half Day") halfDayCount++;

      if (record.status === "Late" || record.lateCheckIn) {
        lateCount++;
      }
    } else {
      if (!isSunday) {
        absentCount++;
      }
    }
  });

  return {
    presentCount,
    absentCount,
    halfDayCount,
    onLeaveCount,
    lateCount,
    totalEmployees: employees.length,
  };
}

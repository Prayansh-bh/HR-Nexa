import type { Employee } from "../../types/employee";
import { getBusinessDateString } from "../../utils/date.utils";

export type DeptLeaveUtilization = {
  dept: string;
  total: number;
  present: number;
  absent: number;
  onLeave: number;
  halfDay: number;
  leavePercent: number;
  statusText: string;
  statusTone: "green" | "amber" | "rose" | "indigo";
};

export function calcDepartmentLeaveUtilization(
  dept: string,
  deptEmps: Employee[],
  attendanceRecords: any[] = [],
  dateStr?: string,
): DeptLeaveUtilization {
  const today = dateStr || getBusinessDateString();
  const total = deptEmps.length;
  let present = 0;
  let absent = 0;
  let onLeave = 0;
  let halfDay = 0;

  deptEmps.forEach((emp) => {
    const record = attendanceRecords.find((r) => r.employeeId === emp.id && r.date === today);
    if (record) {
      if (record.status === "Present" || record.status === "Late") present++;
      else if (record.status === "Absent") absent++;
      else if (record.status === "On Leave") onLeave++;
      else if (record.status === "Half Day") halfDay++;
    } else {
      const isSunday = new Date(today).getDay() === 0;
      if (!isSunday) absent++;
    }
  });

  const leavePercent = total > 0 ? ((onLeave + absent) / total) * 100 : 0;

  let statusText = "Healthy";
  let statusTone: "green" | "amber" | "rose" | "indigo" = "green";

  if (leavePercent <= 5) {
    statusText = "Excellent";
    statusTone = "green";
  } else if (leavePercent <= 15) {
    statusText = "Healthy";
    statusTone = "green";
  } else if (leavePercent <= 25) {
    statusText = "Medium Leave";
    statusTone = "amber";
  } else {
    statusText = "High Leave";
    statusTone = "rose";
  }

  return {
    dept,
    total,
    present,
    absent,
    onLeave,
    halfDay,
    leavePercent: Math.round(leavePercent),
    statusText,
    statusTone,
  };
}

export function calcAllDepartmentsUtilization(
  employees: Employee[],
  attendanceRecords: any[] = [],
  dateStr?: string,
): DeptLeaveUtilization[] {
  const depts = Array.from(new Set(employees.map((e) => e.department)));
  return depts.map((dept) => {
    const deptEmps = employees.filter((e) => e.department === dept);
    return calcDepartmentLeaveUtilization(dept, deptEmps, attendanceRecords, dateStr);
  });
}

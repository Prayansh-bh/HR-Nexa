export function mapApiAttendanceToModel(r: any): any {
  const inVal = r.inTime ?? (r.checkIn && r.checkIn !== "–" ? r.checkIn : null);
  const outVal = r.outTime ?? (r.checkOut && r.checkOut !== "–" ? r.checkOut : null);
  return {
    id: r.id,
    employeeId: r.employeeId,
    employeeName: r.employee?.name || r.employeeName || "Unknown",
    date: r.date,
    checkIn: inVal,
    checkOut: outVal,
    inTime: inVal,
    outTime: outVal,
    status: r.status,
    verificationType: r.remarks || "Biometric Sync",
    lateCheckIn: Boolean(inVal && inVal > "09:15"),
    remarks: r.remarks,
  };
}

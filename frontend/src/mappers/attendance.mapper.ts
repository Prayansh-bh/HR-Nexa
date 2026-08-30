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
    verificationType:
      r.source === "ONLINE"
        ? "Online Web"
        : r.source === "MOBILE"
          ? "Mobile Check-In"
          : r.source === "BIOMETRIC"
            ? "Biometric Sync"
            : r.source === "MANUAL"
              ? (r.remarks || "Manual Entry")
              : r.source === "UNKNOWN"
                ? "Unknown"
                : (r.remarks || "Unknown"),
    lateCheckIn: Boolean(inVal && inVal > "09:15"),
    remarks: r.remarks,
    source: r.source,
  };
}

/**
 * Authoritative Shift & Attendance Business Rules Utility
 *
 * Centralizes shift timing, grace period evaluation, half-day threshold checking,
 * and overtime multiplier calculations. Pure, side-effect-free, and tenant-aware.
 */

export interface AttendanceRulesConfig {
  shiftStart?: string | null; // e.g. "09:00"
  shiftEnd?: string | null;   // e.g. "18:00"
  gracePeriod?: number | null; // e.g. 15 (minutes)
  halfDayThreshold?: number | null; // e.g. 240 (minutes)
  otMultiplier?: number | null; // e.g. 1.5
}

export function parseTimeToMinutes(timeStr?: string | null): number | null {
  if (!timeStr || typeof timeStr !== 'string' || timeStr === '—' || timeStr === '-') {
    return null;
  }
  const parts = timeStr.trim().split(':').map(Number);
  if (parts.length < 2 || isNaN(parts[0]) || isNaN(parts[1])) {
    return null;
  }
  return parts[0] * 60 + parts[1];
}

/**
 * Evaluates inTime and outTime against tenant shift settings to determine
 * whether the status should be 'Present', 'Late', or 'Half Day'.
 */
export function calculateAttendanceStatus(
  inTime?: string | null,
  outTime?: string | null,
  config?: AttendanceRulesConfig | null,
  currentStatus?: string | null,
): string {
  // Preserve explicit Leave, Holiday, or Absent administrative statuses
  if (
    currentStatus === 'On Leave' ||
    currentStatus === 'Holiday' ||
    currentStatus === 'Absent' ||
    currentStatus === 'Weekend'
  ) {
    return currentStatus;
  }

  const inMinutes = parseTimeToMinutes(inTime);
  if (inMinutes === null) {
    return currentStatus || 'Absent';
  }

  const shiftStartMinutes = parseTimeToMinutes(config?.shiftStart) ?? 9 * 60; // Default 09:00
  const graceMinutes = typeof config?.gracePeriod === 'number' && config.gracePeriod >= 0 ? config.gracePeriod : 15;
  const lateThresholdMinutes = shiftStartMinutes + graceMinutes;

  const isLate = inMinutes > lateThresholdMinutes;

  // Check worked duration for Half Day threshold if outTime is present
  const outMinutes = parseTimeToMinutes(outTime);
  let isHalfDay = false;

  if (outMinutes !== null && outMinutes > inMinutes) {
    const workedMinutes = outMinutes - inMinutes;
    const threshold = typeof config?.halfDayThreshold === 'number' && config.halfDayThreshold > 0 ? config.halfDayThreshold : 240;
    if (workedMinutes < threshold) {
      isHalfDay = true;
    }
  }

  if (isHalfDay) {
    return 'Half Day';
  }
  if (isLate) {
    return 'Late';
  }

  return 'Present';
}

/**
 * Calculates Overtime Pay using daily rate (salary / 26 / 8) and tenant otMultiplier.
 */
export function calculateOvertimePay(
  monthlySalary: number,
  overtimeHours: number = 0,
  config?: AttendanceRulesConfig | null,
): number {
  if (!overtimeHours || overtimeHours <= 0 || !monthlySalary || monthlySalary <= 0) {
    return 0;
  }
  const multiplier = typeof config?.otMultiplier === 'number' && config.otMultiplier > 0 ? config.otMultiplier : 1.5;
  const hourlyRate = monthlySalary / 26 / 8;
  return Math.round(hourlyRate * overtimeHours * multiplier);
}

/**
 * Determines whether a scheduled work shift has finished by comparing current time against
 * shiftStart and shiftEnd, with full support for both standard day shifts (e.g. 09:00 - 18:00)
 * and overnight shifts (e.g. 22:00 - 06:00).
 */
export function hasShiftEnded(
  shiftStartStr?: string | null,
  shiftEndStr?: string | null,
  nowTimeStr?: string | null,
): boolean {
  const startM = parseTimeToMinutes(shiftStartStr) ?? 9 * 60; // Default 09:00
  const endM = parseTimeToMinutes(shiftEndStr) ?? 18 * 60;    // Default 18:00
  const nowM = parseTimeToMinutes(nowTimeStr);

  if (nowM === null) return false;

  if (startM < endM) {
    // Standard Day Shift (e.g. 09:00 -> 18:00): ended only if nowM > endM
    return nowM > endM;
  } else if (startM > endM) {
    // Overnight Shift (e.g. 22:00 -> 06:00):
    // Shift is ongoing from startM (22:00) to 23:59 AND from 00:00 to endM (06:00).
    // Shift has ended only when nowM > endM (06:00) AND nowM < startM (22:00).
    return nowM > endM && nowM < startM;
  }

  // 24-hour shift (startM === endM): never ended
  return false;
}


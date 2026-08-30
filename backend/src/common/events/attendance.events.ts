/**
 * Attendance Lifecycle Domain Events
 */

export class AttendanceMarkedEvent {
  constructor(
    public readonly attendanceId: string,
    public readonly employeeId: string,
    public readonly status: string,
    public readonly date: string,
    public readonly timestamp: string = new Date().toISOString(),
  ) {}
}

export class AttendanceUpdatedEvent {
  constructor(
    public readonly attendanceId: string,
    public readonly employeeId: string,
    public readonly status: string,
    public readonly date: string,
    public readonly timestamp: string = new Date().toISOString(),
  ) {}
}

export class AttendanceApprovedEvent {
  constructor(
    public readonly attendanceId: string,
    public readonly employeeId: string,
    public readonly timestamp: string = new Date().toISOString(),
  ) {}
}

export const ATTENDANCE_EVENTS = {
  MARKED: 'attendance.marked',
  UPDATED: 'attendance.updated',
  APPROVED: 'attendance.approved',
} as const;

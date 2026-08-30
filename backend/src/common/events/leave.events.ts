/**
 * Leave Lifecycle Domain Events
 */

export class LeaveUpdatedEvent {
  constructor(
    public readonly leaveId: string,
    public readonly employeeId: string,
    public readonly status: string,
    public readonly timestamp: string = new Date().toISOString(),
  ) {}
}

export const LEAVE_EVENTS = {
  UPDATED: 'leave.updated',
};

/**
 * Employee Lifecycle Domain Events
 */

export class EmployeeCreatedEvent {
  constructor(
    public readonly employeeId: string,
    public readonly employeeName: string,
    public readonly email: string,
    public readonly companyId?: string,
    public readonly timestamp: string = new Date().toISOString(),
  ) {}
}

export class EmployeeUpdatedEvent {
  constructor(
    public readonly employeeId: string,
    public readonly companyId?: string,
    public readonly changes?: Record<string, any>,
    public readonly timestamp: string = new Date().toISOString(),
  ) {}
}

export class EmployeeDeletedEvent {
  constructor(
    public readonly employeeId: string,
    public readonly companyId?: string,
    public readonly timestamp: string = new Date().toISOString(),
  ) {}
}

export class EmployeeStatusChangedEvent {
  constructor(
    public readonly employeeId: string,
    public readonly newStatus: string,
    public readonly companyId?: string,
    public readonly timestamp: string = new Date().toISOString(),
  ) {}
}

export class EmployeeActivatedEvent {
  constructor(
    public readonly employeeId: string,
    public readonly companyId?: string,
    public readonly timestamp: string = new Date().toISOString(),
  ) {}
}

export class EmployeeDeactivatedEvent {
  constructor(
    public readonly employeeId: string,
    public readonly companyId?: string,
    public readonly timestamp: string = new Date().toISOString(),
  ) {}
}

export const EMPLOYEE_EVENTS = {
  CREATED: 'employee.created',
  UPDATED: 'employee.updated',
  DELETED: 'employee.deleted',
  STATUS_CHANGED: 'employee.status_changed',
  ACTIVATED: 'employee.activated',
  DEACTIVATED: 'employee.deactivated',
} as const;

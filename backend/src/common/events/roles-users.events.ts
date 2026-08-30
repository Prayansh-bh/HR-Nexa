/**
 * Role and User Lifecycle Domain Events
 */

export class UserCreatedEvent {
  constructor(
    public readonly userId: string,
    public readonly email: string,
    public readonly roleName: string,
    public readonly companyId?: string | null,
    public readonly timestamp: string = new Date().toISOString(),
  ) {}
}

export class RoleAssignedEvent {
  constructor(
    public readonly userId: string,
    public readonly roleId: string,
    public readonly roleName: string,
    public readonly companyId?: string | null,
    public readonly timestamp: string = new Date().toISOString(),
  ) {}
}

export class RoleRemovedEvent {
  constructor(
    public readonly userId: string,
    public readonly roleId: string,
    public readonly roleName: string,
    public readonly companyId?: string | null,
    public readonly timestamp: string = new Date().toISOString(),
  ) {}
}

export class ManagerChangedEvent {
  constructor(
    public readonly employeeId: string,
    public readonly oldManagerId: string | null,
    public readonly newManagerId: string | null,
    public readonly companyId?: string | null,
    public readonly timestamp: string = new Date().toISOString(),
  ) {}
}

export class PermissionsChangedEvent {
  constructor(
    public readonly roleId: string,
    public readonly roleName: string,
    public readonly companyId?: string | null,
    public readonly timestamp: string = new Date().toISOString(),
  ) {}
}

export const ROLE_USER_EVENTS = {
  USER_CREATED: 'user.created',
  ROLE_ASSIGNED: 'role.assigned',
  ROLE_REMOVED: 'role.removed',
  MANAGER_CHANGED: 'manager.changed',
  PERMISSIONS_CHANGED: 'permissions.changed',
} as const;

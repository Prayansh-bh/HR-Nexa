import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  ROLE_USER_EVENTS,
  UserCreatedEvent,
  RoleAssignedEvent,
  RoleRemovedEvent,
  ManagerChangedEvent,
  PermissionsChangedEvent,
} from '../events/roles-users.events';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class RolesUsersListener {
  private readonly logger = new Logger(RolesUsersListener.name);

  constructor(private readonly prisma: PrismaService) {}

  @OnEvent(ROLE_USER_EVENTS.USER_CREATED)
  handleUserCreated(event: UserCreatedEvent) {
    this.logger.log(
      `[AuditLog] User Account Created: User ID ${event.userId}, Email ${event.email}, Assigned Role ${event.roleName} in company ${event.companyId}`,
    );
    this.logger.log(
      `[Dashboard] Invalidate statistics for company ${event.companyId}`,
    );
  }

  @OnEvent(ROLE_USER_EVENTS.ROLE_ASSIGNED)
  handleRoleAssigned(event: RoleAssignedEvent) {
    this.logger.log(
      `[AuditLog] Role Assigned: User ID ${event.userId} granted Role ID ${event.roleId} (${event.roleName}) in company ${event.companyId}`,
    );
    this.logger.log(
      `[Notifications] Notify User ${event.userId}: Your account role was updated to ${event.roleName}`,
    );
    this.logger.log(
      `[Recruitment] Sync recruiter profile for User ID ${event.userId}`,
    );
  }

  @OnEvent(ROLE_USER_EVENTS.ROLE_REMOVED)
  handleRoleRemoved(event: RoleRemovedEvent) {
    this.logger.log(
      `[AuditLog] Role Revoked: User ID ${event.userId} lost Role ID ${event.roleId} (${event.roleName}) in company ${event.companyId}`,
    );
  }

  @OnEvent(ROLE_USER_EVENTS.MANAGER_CHANGED)
  async handleManagerChanged(event: ManagerChangedEvent) {
    this.logger.log(
      `[AuditLog] Reporting Hierarchy Updated: Employee ID ${event.employeeId} reports to manager ID ${event.newManagerId} (previously: ${event.oldManagerId})`,
    );

    // Invalidate manager cache or trigger workflow updates in performance/leave modules
    this.logger.log(
      `[Performance] Updating appraisal cycles for subordinate ${event.employeeId}`,
    );
    this.logger.log(
      `[Leave] Re-routing leave approval chains for subordinate ${event.employeeId}`,
    );
  }

  @OnEvent(ROLE_USER_EVENTS.PERMISSIONS_CHANGED)
  handlePermissionsChanged(event: PermissionsChangedEvent) {
    this.logger.log(
      `[AuditLog] Permissions Updated: Role ID ${event.roleId} (${event.roleName}) permissions modified in company ${event.companyId}`,
    );
    this.logger.log(
      `[Security] Force active session invalidation for all users holding Role ID ${event.roleId}`,
    );
  }
}

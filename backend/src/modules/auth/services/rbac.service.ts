import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
  OnModuleInit,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  ROLE_USER_EVENTS,
  PermissionsChangedEvent,
} from '../../../common/events/roles-users.events';
import { Permission } from '../permissions.enum';
import { canUserDelegateRole } from '../../../common/tenant/tenant-validation.util';

import { syncPermissions } from '../../../scripts/seed-permissions';

@Injectable()
export class RbacService implements OnModuleInit {
  private readonly logger = new Logger(RbacService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async onModuleInit() {
    this.logger.log('Synchronizing database Permission-to-Feature mappings on startup...');
    try {
      const res = await syncPermissions(this.prisma);
      this.logger.log(`✅ Idempotently synced ${res.count} Permission-to-Feature database mappings.`);
    } catch (err: any) {
      this.logger.warn(`Permission database sync warning: ${err.message}`);
    }

    this.logger.log('Validating database role permissions on startup...');
    const roles = await this.prisma.role.findMany();
    const validKeys = new Set(Object.values(Permission));
    let totalInvalid = 0;

    for (const r of roles) {
      try {
        const perms: string[] = JSON.parse(r.permissions || '[]');
        const invalid = perms.filter((p) => !validKeys.has(p as any));
        if (invalid.length > 0) {
          totalInvalid += invalid.length;
          this.logger.warn(
            `Role "${r.name}" (ID: ${r.id}, Company: ${r.companyId}) contains ${invalid.length} unmapped/deprecated permission keys: ${invalid.join(', ')}`,
          );
        }
      } catch {}
    }

    if (totalInvalid === 0) {
      this.logger.log('✅ All database role permissions validated successfully (0 invalid keys).');
    }

    // Idempotent sync for existing Employee roles: add EMPLOYEES_ATTENDANCE_REGULARIZE if missing
    try {
      const employeeRoles = await this.prisma.role.findMany({
        where: { name: 'Employee' },
      });
      for (const empRole of employeeRoles) {
        const perms: string[] = JSON.parse(empRole.permissions || '[]');
        if (!perms.includes(Permission.EMPLOYEES_ATTENDANCE_REGULARIZE)) {
          perms.push(Permission.EMPLOYEES_ATTENDANCE_REGULARIZE);
          await this.prisma.role.update({
            where: { id: empRole.id },
            data: { permissions: JSON.stringify(perms) },
          });
          this.logger.log(
            `✅ Idempotently added missing "${Permission.EMPLOYEES_ATTENDANCE_REGULARIZE}" to existing Employee role (ID: ${empRole.id}, Company: ${empRole.companyId})`,
          );
        }
      }

      // Security sanitization: strip settings:roles:* from non-admin system roles
      const operationalRoles = await this.prisma.role.findMany({
        where: {
          name: { in: ['Manager', 'Accountant', 'Recruiter', 'Employee', 'Viewer', 'HR Staff'] },
          isSystem: true,
        },
      });
      for (const opRole of operationalRoles) {
        const perms: string[] = JSON.parse(opRole.permissions || '[]');
        const sanitized = perms.filter(
          (p) => p !== 'settings:roles:view' && p !== 'settings:roles:edit',
        );
        if (sanitized.length !== perms.length) {
          await this.prisma.role.update({
            where: { id: opRole.id },
            data: { permissions: JSON.stringify(sanitized) },
          });
          this.logger.log(
            `🔒 Idempotently stripped administrative role permissions from operational role "${opRole.name}" (ID: ${opRole.id}, Company: ${opRole.companyId})`,
          );
        }
      }
    } catch (err: any) {
      this.logger.warn(`Warning during role permission sync: ${err.message}`);
    }
  }

  // Get permissions for a role dynamically
  async getRolePermissions(
    roleNameOrId: string,
    companyId?: string | null,
  ): Promise<string[]> {
    const role = await this.prisma.role.findFirst({
      where: {
        OR: [
          { id: roleNameOrId },
          { name: roleNameOrId, companyId: companyId ?? undefined },
          { name: roleNameOrId, isSystem: true },
        ],
      },
    });

    if (!role || !role.permissions) {
      return [];
    }

    try {
      return JSON.parse(role.permissions);
    } catch {
      return [];
    }
  }

  async getAllRolePermissions(companyId?: string | null): Promise<Record<string, string[]>> {
    const roles = await this.getRolesForCompany(companyId || null);
    const result: Record<string, string[]> = {};
    for (const r of roles) {
      if (result[r.name]) {
        console.warn(
          `[getAllRolePermissions] Duplicate role detected: ${r.name} (companyId: ${r.companyId}, id: ${r.id})`,
        );
      } else {
        try {
          result[r.name] = JSON.parse(r.permissions || '[]');
        } catch {
          result[r.name] = [];
        }
      }
    }
    return result;
  }

  // Get all roles for a company
  async getRolesForCompany(companyId: string | null): Promise<any[]> {
    if (companyId) {
      return this.prisma.role.findMany({
        where: { companyId },
        orderBy: { createdAt: 'asc' },
      });
    }

    return this.prisma.role.findMany({
      where: {
        companyId: null,
        isSystem: true,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async getRoles(companyId?: string | null) {
    return this.getRolesForCompany(companyId || null);
  }

  async getAssignableRolesForUser(caller: any, companyId: string | null): Promise<any[]> {
    const roles = await this.getRolesForCompany(companyId);
    return roles.filter((role) => canUserDelegateRole(caller, role));
  }

  // Create custom role (Overloaded to support 4-args legacy or object-args signature)
  async createRole(
    companyIdOrData: any,
    name?: string,
    description?: string,
    permissions?: string[],
  ) {
    let companyId: string | null = null;
    let roleName = '';
    let roleDesc = '';
    let rolePerms: string[] = [];

    if (typeof companyIdOrData === 'object' && companyIdOrData !== null) {
      companyId = companyIdOrData.companyId || null;
      roleName = companyIdOrData.name;
      roleDesc = companyIdOrData.description || '';
      rolePerms = companyIdOrData.permissions || [];
    } else {
      companyId = companyIdOrData || null;
      roleName = name || '';
      roleDesc = description || '';
      rolePerms = permissions || [];
    }

    const existing = await this.prisma.role.findFirst({
      where: { name: roleName, companyId: companyId ?? undefined },
    });

    if (existing) {
      throw new ConflictException(`Role with name "${roleName}" already exists for this company`);
    }

    // Validate permission keys if provided
    if (rolePerms && rolePerms.length > 0) {
      const validKeys = new Set(Object.values(Permission));
      const invalidKeys = rolePerms.filter((p) => !validKeys.has(p as any));
      if (invalidKeys.length > 0) {
        throw new BadRequestException(
          `Invalid or unrecognized permission keys: ${invalidKeys.join(', ')}`,
        );
      }
    }

    return this.prisma.role.create({
      data: {
        name: roleName,
        description: roleDesc,
        permissions: JSON.stringify(rolePerms),
        companyId: companyId || null,
        isSystem: false,
      },
    });
  }

  async updateRolePermissions(
    roleIdOrName: string,
    permissions: string[],
    companyId?: string | null,
    actorUserId?: string,
  ) {
    return this.updateRole(roleIdOrName, companyId || null, { permissions }, actorUserId);
  }

  // Update role with permission key validation & security audit diffs
  async updateRole(
    roleId: string,
    companyId: string | null,
    data: { name?: string; description?: string; permissions?: string[] },
    actorUserId?: string,
  ) {
    const role = await this.prisma.role.findFirst({
      where: companyId ? { id: roleId, companyId } : { id: roleId },
    });
    if (!role) {
      throw new NotFoundException(`Role not found`);
    }

    const oldPermissions: string[] = role.permissions
      ? JSON.parse(role.permissions)
      : [];

    const updateData: any = {};
    if (data.name) updateData.name = data.name;
    if (data.description) updateData.description = data.description;

    let addedPermissions: string[] = [];
    let removedPermissions: string[] = [];

    if (data.permissions) {
      // Validate permission keys against registry
      const validKeys = new Set(Object.values(Permission));

      const invalidKeys = data.permissions.filter((p) => !validKeys.has(p as any));
      if (invalidKeys.length > 0) {
        throw new BadRequestException(
          `Invalid permission keys: ${invalidKeys.join(', ')}`,
        );
      }

      addedPermissions = data.permissions.filter(
        (p) => !oldPermissions.includes(p),
      );
      removedPermissions = oldPermissions.filter(
        (p) => !data.permissions?.includes(p),
      );

      updateData.permissions = JSON.stringify(data.permissions);
    }

    const updatedRole = await this.prisma.role.update({
      where: { id: roleId },
      data: updateData,
    });

    // Record security audit record if permissions changed
    if (data.permissions) {
      try {
        await this.prisma.auditLog.create({
          data: {
            userId: actorUserId || 'system',
            userName: 'System Admin',
            actorId: actorUserId || 'system',
            actorRole: 'Admin',
            entityType: 'COMPANY_SETTINGS',
            action: 'SETTINGS_UPDATED',
            details: `[ROLE_PERMISSIONS_UPDATE] Role "${role.name}" permissions updated. Added: [${addedPermissions.join(', ')}], Removed: [${removedPermissions.join(', ')}]`,
            companyId: role.companyId || 'PLATFORM',
          },
        });
      } catch (e) {
        // Audit log fallback
      }
    }

    // Update users cached role name if renamed
    if (data.name && data.name !== role.name) {
      await this.prisma.user.updateMany({
        where: { roleId },
        data: { role: data.name },
      });
    }

    // Force user token rotation by incrementing permissionVersion
    await this.prisma.user.updateMany({
      where: {
        OR: [
          { roleId },
          { role: role.name, companyId: role.companyId || null },
        ],
      },
      data: { permissionVersion: { increment: 1 } },
    });

    this.eventEmitter.emit(
      ROLE_USER_EVENTS.PERMISSIONS_CHANGED,
      new PermissionsChangedEvent(roleId, data.name || role.name, companyId),
    );

    return updatedRole;
  }

  // Delete role
  async deleteRole(roleId: string, companyId: string) {
    const role = await this.prisma.role.findFirst({
      where: { id: roleId, companyId },
    });
    if (!role) {
      throw new NotFoundException(`Role not found`);
    }

    if (role.isSystem) {
      throw new BadRequestException('System default roles cannot be deleted.');
    }

    const usersCount = await this.prisma.user.count({
      where: { roleId },
    });
    if (usersCount > 0) {
      throw new BadRequestException(
        `Cannot delete role '${role.name}' because ${usersCount} users are currently assigned to it. Reassign those users first.`,
      );
    }

    return this.prisma.role.delete({
      where: { id: roleId },
    });
  }
}

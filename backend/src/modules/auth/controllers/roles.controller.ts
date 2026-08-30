import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  ForbiddenException,
  Query,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../jwt-auth.guard';
import { RolesGuard } from '../roles.guard';
import { PermissionsGuard } from '../permissions.guard';
import { SubscriptionGuard } from '../subscription.guard';
import { RequirePermissions } from '../permissions.decorator';
import { Permission } from '../permissions.enum';
import { Roles } from '../roles.decorator';
import { Role } from '../role.enum';
import { RbacService } from '../services/rbac.service';
import { AuthenticatedRequest } from '../interfaces/authenticated-request.interface';
import { PrismaService } from '../../../prisma/prisma.service';

import { RoleProvisioningService } from '../services/role-provisioning.service';

@ApiTags('Roles')
@Controller('auth/roles-mgmt')
@UseGuards(JwtAuthGuard, SubscriptionGuard, RolesGuard, PermissionsGuard)
@ApiBearerAuth()
export class RolesController {
  constructor(
    private readonly rbacService: RbacService,
    private readonly roleProvisioningService: RoleProvisioningService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Resolve the effective tenant companyId for mutating operations.
   *
   * SuperAdmin: must supply an explicit `targetCompanyId` (from body/query).
   * Tenant user: always their own companyId from the JWT (never 'PLATFORM').
   */
  private getEffectiveCompanyId(
    req: AuthenticatedRequest,
    targetCompanyId?: string,
  ): string {
    if (req.user.role === 'SuperAdmin') {
      if (!targetCompanyId) {
        throw new BadRequestException(
          'companyId is required for SuperAdmin operations',
        );
      }
      return targetCompanyId;
    }
    const own =
      req.user.companyId && req.user.companyId !== 'PLATFORM'
        ? req.user.companyId
        : null;
    if (!own) {
      throw new BadRequestException(
        'Unable to determine company context for this user',
      );
    }
    return own;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // GET  /auth/roles-mgmt/assignable
  // ─────────────────────────────────────────────────────────────────────────
  @Get('assignable')
  @ApiOperation({ summary: 'Get assignable tenant roles for employee onboarding' })
  async getAssignableRoles(
    @Request() req: AuthenticatedRequest,
  ) {
    const user = req.user;
    const canCreateEmployees =
      user.role === 'SuperAdmin' ||
      user.role === 'CompanyOwner' ||
      user.role === 'HRAdmin' ||
      user.permissions?.includes(Permission.EMPLOYEES_LIST_CREATE) ||
      user.permissions?.includes(Permission.EMPLOYEES_CREATE) ||
      user.permissions?.includes('employees:list:create') ||
      user.permissions?.includes('employees:profile:create') ||
      user.permissions?.includes(Permission.SETTINGS_ROLES_VIEW) ||
      user.permissions?.includes('settings:roles:view');

    if (!canCreateEmployees) {
      throw new ForbiddenException(
        'Insufficient permissions to list assignable roles',
      );
    }

    const isSuperAdmin = user.role === 'SuperAdmin';
    const targetCompanyId = isSuperAdmin
      ? null
      : user.companyId !== 'PLATFORM'
      ? user.companyId
      : null;

    return this.rbacService.getAssignableRolesForUser(user, targetCompanyId);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // GET  /auth/roles-mgmt
  // ─────────────────────────────────────────────────────────────────────────
  @Get()
  @RequirePermissions(Permission.SETTINGS_ROLES_VIEW)
  @ApiOperation({ summary: 'Get all roles for the current company' })
  async getRoles(
    @Request() req: AuthenticatedRequest,
    @Query('companyId') companyId?: string,
  ) {
    const isSuperAdmin = req.user.role === 'SuperAdmin';
    const targetCompanyId = isSuperAdmin
      ? companyId || null
      : req.user.companyId !== 'PLATFORM'
      ? req.user.companyId
      : null;

    const roles = await this.rbacService.getRolesForCompany(targetCompanyId);

    if (!isSuperAdmin) {
      return roles.filter((r) => r.name !== 'SuperAdmin');
    }
    return roles;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // POST /auth/roles-mgmt/bootstrap
  // ─────────────────────────────────────────────────────────────────────────
  @Post('bootstrap')
  @Roles(Role.SuperAdmin)
  @RequirePermissions(Permission.SETTINGS_ROLES_EDIT)
  @ApiOperation({ summary: 'Idempotently bootstrap missing default roles for a tenant' })
  async bootstrapRoles(
    @Request() req: AuthenticatedRequest,
    @Body('companyId') bodyCompanyId?: string,
    @Query('companyId') queryCompanyId?: string,
  ) {
    const requestedCompanyId = bodyCompanyId || queryCompanyId;
    const companyId = this.getEffectiveCompanyId(req, requestedCompanyId);

    await this.prisma.auditLog.create({
      data: {
        userId: req.user.id,
        userName: req.user.name,
        actorId: req.user.id || 'system',
        actorRole: req.user.role || 'SuperAdmin',
        entityType: 'COMPANY_SETTINGS',
        action: 'SETTINGS_UPDATED',
        details: `[ROLE_BOOTSTRAP_SUPERADMIN] SuperAdmin initiated default role bootstrap for company ${companyId}`,
        companyId,
      },
    });

    const rolesMap = await this.roleProvisioningService.ensureDefaultRoles(companyId);
    return Object.values(rolesMap);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // POST /auth/roles-mgmt
  // ─────────────────────────────────────────────────────────────────────────
  @Post()
  @RequirePermissions(Permission.SETTINGS_ROLES_EDIT)
  @ApiOperation({ summary: 'Create custom role for the company' })
  async createRole(
    @Request() req: AuthenticatedRequest,
    @Body('name') name: string,
    @Body('description') description: string,
    @Body('permissions') permissions: string[],
    @Body('companyId') targetCompanyId?: string,
  ) {
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      throw new BadRequestException('Role name is required.');
    }

    const trimmedName = name.trim();

    if (trimmedName.length > 60) {
      throw new BadRequestException('Role name cannot exceed 60 characters.');
    }

    if (!/^[a-zA-Z0-9 _-]+$/.test(trimmedName)) {
      throw new BadRequestException(
        'Role name contains invalid characters. Only letters, numbers, spaces, underscores, and hyphens are allowed.',
      );
    }

    const reservedRoleNames = Object.values(Role).map((r) => r.toLowerCase());
    if (reservedRoleNames.includes(trimmedName.toLowerCase())) {
      throw new BadRequestException(
        `Role name "${trimmedName}" is reserved for system roles.`,
      );
    }

    const companyId = this.getEffectiveCompanyId(req, targetCompanyId);

    const existing = await this.prisma.role.findFirst({
      where: { name: trimmedName, companyId },
    });
    if (existing) {
      throw new BadRequestException(
        `Role with name "${trimmedName}" already exists for this company.`,
      );
    }

    await this.prisma.auditLog.create({
      data: {
        userId: req.user.id,
        userName: req.user.name,
        actorId: req.user.id || 'system',
        actorRole: req.user.role || 'HRAdmin',
        entityType: 'COMPANY_SETTINGS',
        action: 'SETTINGS_UPDATED',
        details: `[ROLE_CREATE] User ${req.user.name} (${req.user.role}) created role "${name}" for company ${companyId} with permissions: ${JSON.stringify(permissions || [])}`,
        companyId,
      },
    });

    return this.rbacService.createRole(companyId, name.trim(), description, permissions || []);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PUT  /auth/roles-mgmt/:id
  // ─────────────────────────────────────────────────────────────────────────
  @Put(':id')
  @RequirePermissions(Permission.SETTINGS_ROLES_EDIT)
  @ApiOperation({ summary: 'Update dynamic role details and permissions' })
  async updateRole(
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest,
    @Body('name') name?: string,
    @Body('description') description?: string,
    @Body('permissions') permissions?: string[],
    @Body('companyId') targetCompanyId?: string,
  ) {
    const companyId = this.getEffectiveCompanyId(req, targetCompanyId);

    const existingRole = await this.prisma.role.findFirst({
      where: { id, companyId },
    });
    if (!existingRole) {
      throw new ForbiddenException('Role not found or access denied.');
    }

    if (existingRole.isSystem && req.user.role !== 'SuperAdmin') {
      throw new ForbiddenException('Cannot modify system built-in roles.');
    }

    if (
      req.user.role !== 'SuperAdmin' &&
      (req.user.role === existingRole.name || req.user.roleId === existingRole.id)
    ) {
      throw new ForbiddenException(
        'Users cannot modify their own active role or permissions.',
      );
    }

    await this.prisma.auditLog.create({
      data: {
        userId: req.user.id,
        userName: req.user.name,
        actorId: req.user.id || 'system',
        actorRole: req.user.role || 'HRAdmin',
        entityType: 'COMPANY_SETTINGS',
        action: 'SETTINGS_UPDATED',
        details: `[ROLE_UPDATE] User ${req.user.name} (${req.user.role}) modified role "${existingRole.name}" (ID ${id}) for company ${companyId}. New permissions: ${JSON.stringify(permissions || [])}`,
        companyId,
      },
    });

    return this.rbacService.updateRole(id, companyId, { name, description, permissions });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // DELETE /auth/roles-mgmt/:id
  // ─────────────────────────────────────────────────────────────────────────
  @Delete(':id')
  @RequirePermissions(Permission.SETTINGS_ROLES_EDIT)
  @ApiOperation({ summary: 'Delete custom role' })
  async deleteRole(
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest,
    @Query('companyId') targetCompanyId?: string,
  ) {
    const companyId = this.getEffectiveCompanyId(req, targetCompanyId);

    const existingRole = await this.prisma.role.findFirst({
      where: { id, companyId },
    });
    if (!existingRole) {
      throw new ForbiddenException('Role not found or access denied.');
    }

    if (existingRole.isSystem) {
      throw new ForbiddenException('System default roles cannot be deleted.');
    }

    if (req.user.role === existingRole.name || req.user.roleId === existingRole.id) {
      throw new ForbiddenException('Users cannot delete their own active role.');
    }

    await this.prisma.auditLog.create({
      data: {
        userId: req.user.id,
        userName: req.user.name,
        actorId: req.user.id || 'system',
        actorRole: req.user.role || 'HRAdmin',
        entityType: 'COMPANY_SETTINGS',
        action: 'SETTINGS_UPDATED',
        details: `[ROLE_DELETE] User ${req.user.name} (${req.user.role}) deleted role "${existingRole.name}" (ID ${id}) for company ${companyId}.`,
        companyId,
      },
    });

    return this.rbacService.deleteRole(id, companyId);
  }
}

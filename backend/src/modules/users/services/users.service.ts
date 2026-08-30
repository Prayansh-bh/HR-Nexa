/**
 * UsersService
 *
 * Single Responsibility: Manage platform user accounts (CRUD, role, status).
 * Enforces the critical invariant: EXACTLY ONE SuperAdmin on the platform.
 */
import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { UserRepository } from '../../auth/repositories/user.repository';
import { AuthService } from '../../auth/services/auth.service';
import { Role } from '../../auth/role.enum';

@Injectable()
export class UsersService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly authService: AuthService,
  ) {}

  // ───────────────────────────────────────────────────────────────────────
  // SuperAdmin Single-Instance Guards
  // ───────────────────────────────────────────────────────────────────────

  /**
   * Throws ConflictException if assigning role=SuperAdmin would create
   * a second SuperAdmin. `exemptUserId` is the current SuperAdmin being
   * updated (i.e., they are allowed to keep their own role).
   */
  private async enforceSingleSuperAdmin(
    targetRole: string,
    exemptUserId?: string,
  ): Promise<void> {
    if (targetRole !== Role.SuperAdmin) return;

    const res = await this.userRepository.findMany();
    const existingAdmins = res.data.filter(
      (u) => u.role === Role.SuperAdmin && u.id !== exemptUserId,
    );

    if (existingAdmins.length >= 1) {
      throw new ConflictException(
        'Only one Super Admin is allowed on the platform. Demote the existing Super Admin first.',
      );
    }
  }

  /**
   * Throws ForbiddenException if the target user is the SuperAdmin and
   * the caller is trying to delete them.
   */
  private async preventDeletingSuperAdmin(userId: string): Promise<void> {
    const user = await this.userRepository.findById(userId);
    if (user?.role === Role.SuperAdmin) {
      throw new ForbiddenException(
        'The platform Super Admin account cannot be deleted.',
      );
    }
  }

  /**
   * Throws ForbiddenException if the target user is the SuperAdmin and
   * the caller is trying to lock or disable them.
   */
  private async preventDisablingSuperAdmin(
    userId: string,
    newStatus?: string,
  ): Promise<void> {
    if (!newStatus) return;
    const lockingStatuses = ['Locked', 'Disabled', 'Inactive'];
    if (!lockingStatuses.includes(newStatus)) return;

    const user = await this.userRepository.findById(userId);
    if (user?.role === Role.SuperAdmin) {
      throw new ForbiddenException(
        'The platform Super Admin account cannot be locked or disabled.',
      );
    }
  }

  private assertTenantOwnership(currentUser: any, targetUser: any) {
    if (currentUser?.role === Role.SuperAdmin) {
      return;
    }
    const currentTenant = currentUser?.companyId || currentUser?.subscriptionId;
    const targetTenant = targetUser.companyId || targetUser.subscriptionId;

    if (!currentTenant || !targetTenant || currentTenant !== targetTenant) {
      throw new ForbiddenException(
        'Access denied: You cannot view or modify user accounts belonging to another tenant.',
      );
    }
  }

  // ───────────────────────────────────────────────────────────────────────
  // CRUD operations
  // ───────────────────────────────────────────────────────────────────────

  async getAllUsers(
    currentUser?: any,
    options?: { page?: number; limit?: number; search?: string; role?: string; status?: string },
  ) {
    const isSuperAdmin = currentUser?.role === Role.SuperAdmin;
    const tenantCompanyId = isSuperAdmin
      ? null
      : currentUser?.companyId || currentUser?.subscriptionId || null;

    const result = await this.userRepository.findMany({
      tenantCompanyId,
      page: options?.page,
      limit: options?.limit,
      search: options?.search,
      role: options?.role,
      status: options?.status,
    });

    const formattedData = result.data.map((user) => {
      // Determine company display name from subscriptionId or role
      let company = 'Unknown';
      if (user.role === Role.SuperAdmin || !user.subscriptionId) {
        company = 'System';
      } else {
        // Display the subscriptionId; frontend maps it to company name
        company =
          (user as any).subscription?.company ||
          user.subscriptionId ||
          'Unassigned';
      }

      // Convert database role name to UI-friendly name
      let uiRole = user.role;
      if (user.role === 'SuperAdmin') uiRole = 'Super Admin';
      else if (user.role === 'HRAdmin') uiRole = 'HR Admin';

      return {
        id: user.id,
        name: user.name,
        email: user.email,
        company,
        subscriptionId: user.subscriptionId ?? null,
        role: uiRole,
        status: user.status,
        lastLogin: user.updatedAt.toISOString().slice(0, 16).replace('T', ' '),
      };
    });

    return {
      data: formattedData,
      total: result.total,
      page: result.page,
      limit: result.limit,
    };
  }

  private getTenantId(currentUser: any): string | null {
    if (currentUser?.role === Role.SuperAdmin) return null;
    return currentUser?.companyId || currentUser?.subscriptionId || null;
  }

  async updateUser(currentUser: any, id: string, data?: { role?: string; status?: string }) {
    const tenantId = this.getTenantId(currentUser);
    const user = await this.userRepository.findByIdAndTenant(id, tenantId);
    if (!user) {
      throw new NotFoundException(`User with id "${id}" not found`);
    }

    const inputData = data || {};

    // Normalize UI role names back to DB role enum values
    let dbRole = inputData.role || user.role;
    if (inputData.role === 'Super Admin') dbRole = 'SuperAdmin';
    else if (inputData.role === 'HR Admin') dbRole = 'HRAdmin';

    // Enforce: cannot lock/disable the SuperAdmin
    await this.preventDisablingSuperAdmin(id, inputData.status);

    // Enforce: cannot promote another user to SuperAdmin if one already exists
    await this.enforceSingleSuperAdmin(dbRole, id);

    // When locking/disabling, revoke all refresh sessions immediately
    if (inputData.status === 'Locked' || inputData.status === 'Disabled') {
      try {
        this.authService.revokeUserSessions(id);
      } catch {
        // Non-fatal: session revocation may fail gracefully
      }
    }

    return this.userRepository.updateUser(id, {
      role: dbRole,
      status: inputData.status || user.status,
    });
  }

  async forceLogout(currentUser: any, id: string) {
    const tenantId = this.getTenantId(currentUser);
    const user = await this.userRepository.findByIdAndTenant(id, tenantId);
    if (!user) {
      throw new NotFoundException(`User with id "${id}" not found`);
    }

    // Enforce: cannot force-logout the SuperAdmin
    if (user.role === Role.SuperAdmin) {
      throw new ForbiddenException(
        'The platform Super Admin account cannot be force-logged out.',
      );
    }

    // 1. Revoke all active refresh token sessions
    this.authService.revokeUserSessions(id);

    // 2. Set account status to Locked so JWT strategy rejects all subsequent requests
    await this.userRepository.updateUser(id, { status: 'Locked' });

    return {
      message: `User "${user.name}" has been force-logged out and account locked`,
      userId: id,
      status: 'Locked',
    };
  }

  async deleteUser(currentUser: any, id: string) {
    const tenantId = this.getTenantId(currentUser);
    const user = await this.userRepository.findByIdAndTenant(id, tenantId);
    if (!user) {
      throw new NotFoundException(`User with id "${id}" not found`);
    }

    // Enforce: SuperAdmin cannot be deleted
    await this.preventDeletingSuperAdmin(id);

    try {
      this.authService.revokeUserSessions(id);
    } catch {
      // Non-fatal
    }

    await this.userRepository.deleteUser(id);

    return {
      message: `User "${user.name}" deleted successfully`,
      userId: id,
    };
  }
}

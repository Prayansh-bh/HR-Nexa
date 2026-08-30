import { ForbiddenException } from '@nestjs/common';
import { TenantScope } from './tenant-scope.interface';

export class TenantContext {
  /**
   * Determine whether the authenticated user is a SuperAdmin.
   * Note: SuperAdmins are STILL tenant-scoped by default unless executing an explicit Platform Scope endpoint.
   */
  static isSuperAdmin(user: any): boolean {
    return user?.role === 'SuperAdmin';
  }

  /**
   * Resolve strongly-typed TenantScope from authenticated user object.
   * Fails closed (HTTP 403 Forbidden) if a non-SuperAdmin request lacks a valid tenant ID.
   *
   * @param user Authenticated user object from req.user
   * @param isPlatformEndpoint Optional flag indicating if endpoint is explicitly platform-scoped
   */
  static getRequiredTenantScope(
    user: any,
    isPlatformEndpoint = false,
  ): TenantScope {
    const isSuperAdmin = this.isSuperAdmin(user);

    if (isSuperAdmin && isPlatformEndpoint) {
      return {
        companyId: 'PLATFORM',
        subscriptionId: null,
        isSuperAdmin: true,
        isPlatformBypass: true,
      };
    }

    // Resolve companyId strictly from req.user (NEVER from body/query params)
    const companyId = user?.companyId || user?.subscriptionId;

    if (
      !isSuperAdmin &&
      (!companyId || typeof companyId !== 'string' || companyId.trim().length === 0)
    ) {
      throw new ForbiddenException(
        'Access denied: Missing valid tenant context.',
      );
    }

    const resolvedCompanyId =
      companyId && companyId.trim().length > 0
        ? companyId.trim()
        : isSuperAdmin
          ? 'PLATFORM'
          : '';

    if (!isSuperAdmin && !resolvedCompanyId) {
      throw new ForbiddenException(
        'Access denied: Invalid tenant context resolved.',
      );
    }

    return {
      companyId: resolvedCompanyId,
      subscriptionId: user?.subscriptionId || null,
      isSuperAdmin,
      isPlatformBypass: false,
    };
  }

  /**
   * Resolve TenantScope allowing SuperAdmin optional company override.
   * Non-SuperAdmin users will ALWAYS be restricted to their own tenant context.
   */
  static getOptionalTenantScope(
    user: any,
    requestedCompanyId?: string | null,
    isPlatformEndpoint = false,
  ): TenantScope {
    const isSuperAdmin = this.isSuperAdmin(user);

    if (isSuperAdmin) {
      if (requestedCompanyId && requestedCompanyId.trim().length > 0) {
        return {
          companyId: requestedCompanyId.trim(),
          subscriptionId: null,
          isSuperAdmin: true,
          isPlatformBypass: false,
        };
      }
      return {
        companyId: 'PLATFORM',
        subscriptionId: null,
        isSuperAdmin: true,
        isPlatformBypass: true,
      };
    }

    return this.getRequiredTenantScope(user, isPlatformEndpoint);
  }
}

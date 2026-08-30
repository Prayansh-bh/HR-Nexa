import type { PermissionKey } from "./permissions";

export interface UserLike {
  role?: string;
  permissions?: string[];
  [key: string]: any;
}

export interface PermissionEvaluationOptions {
  allowAlias?: boolean;
}

/**
 * Pure Authorization Engine
 *
 * Centralizes all permission evaluation rules, SuperAdmin root bypass,
 * and multi-permission (any / all) evaluation. Pure and side-effect free.
 */

/**
 * Check if user is a platform SuperAdmin (root bypass)
 */
export function isSuperAdmin(user?: UserLike | null): boolean {
  return user?.role === "SuperAdmin";
}

/**
 * Evaluate single permission against user permissions context
 */
export function hasPermission(
  user: UserLike | null | undefined,
  requiredPermission?: PermissionKey | string | null,
  options?: PermissionEvaluationOptions,
): boolean {
  if (!requiredPermission) return true;
  if (!user) return false;

  // Rule 1: SuperAdmin root bypass
  if (isSuperAdmin(user)) return true;

  const userPerms = user.permissions || [];
  if (userPerms.length === 0) return false;

  // Rule 2: Direct match
  if (userPerms.includes(requiredPermission)) return true;

  // Rule 3: Backward-compatible alias matching (if enabled)
  if (options?.allowAlias !== false) {
    if (
      requiredPermission === "employees:list:view" ||
      requiredPermission === "employees:read"
    ) {
      return (
        userPerms.includes("employees:list:view") ||
        userPerms.includes("employees:read")
      );
    }
    if (
      requiredPermission === "payroll:process:view" ||
      requiredPermission === "payroll:read"
    ) {
      return (
        userPerms.includes("payroll:process:view") ||
        userPerms.includes("payroll:read")
      );
    }
    if (
      requiredPermission === "system:audit:view" ||
      requiredPermission === "system:audit:read"
    ) {
      return (
        userPerms.includes("system:audit:view") ||
        userPerms.includes("system:audit:read")
      );
    }
    if (
      requiredPermission === "leaves:requests:view" ||
      requiredPermission === "leaves:read" ||
      requiredPermission === "leaves:view"
    ) {
      return (
        userPerms.includes("leaves:requests:view") ||
        userPerms.includes("leaves:read") ||
        userPerms.includes("leaves:view")
      );
    }
    if (
      requiredPermission === "leaves:requests:create" ||
      requiredPermission === "leaves:create"
    ) {
      return (
        userPerms.includes("leaves:requests:create") ||
        userPerms.includes("leaves:create")
      );
    }
    if (
      requiredPermission === "leaves:requests:approve" ||
      requiredPermission === "leaves:approve"
    ) {
      return (
        userPerms.includes("leaves:requests:approve") ||
        userPerms.includes("leaves:approve")
      );
    }
  }

  // Rule 4: Explicit wildcard matching (e.g. "employees:*" or "*")
  return userPerms.some((p) => {
    if (p === "*" || p === `${requiredPermission.split(":")[0]}:*`) return true;
    if (p.endsWith("*")) {
      const prefix = p.slice(0, -1);
      return requiredPermission.startsWith(prefix);
    }
    return false;
  });
}

/**
 * Evaluate multiple permissions (mode: "any" | "all")
 */
export function hasPermissions(
  user: UserLike | null | undefined,
  requiredPermissions: (PermissionKey | string)[],
  mode: "any" | "all" = "all",
  options?: PermissionEvaluationOptions,
): boolean {
  if (!requiredPermissions || requiredPermissions.length === 0) return true;
  if (!user) return false;

  if (isSuperAdmin(user)) return true;

  if (mode === "any") {
    return requiredPermissions.some((perm) =>
      hasPermission(user, perm, options),
    );
  }

  return requiredPermissions.every((perm) =>
    hasPermission(user, perm, options),
  );
}

/**
 * Resolve standard landing dashboard route for user role
 */
export function getDefaultDashboardRoute(user?: UserLike | null): string {
  return isSuperAdmin(user) ? "/super-admin/dashboard" : "/dashboard";
}

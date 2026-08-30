import { useMemo } from "react";
import { useAuthStore } from "../store/authStore";
import type { AuthUser } from "../types";
import {
  hasPermission as evalPermission,
  hasPermissions as evalPermissions,
  PermissionEvaluationOptions,
} from "./authorization";
import type { PermissionKey } from "./permissions";

export interface UseHasPermissionOptions extends PermissionEvaluationOptions {
  permission?: PermissionKey | string | null;
  permissions?: (PermissionKey | string)[];
  mode?: "any" | "all";
}

/**
 * Custom React Hook to check if the current user possesses required permission(s).
 */
export function useHasPermission(
  permissionOrOptions?: PermissionKey | string | (PermissionKey | string)[] | UseHasPermissionOptions | null,
  mode: "any" | "all" = "all",
): boolean {
  const user = useAuthStore((state) => state.user);

  return useMemo(() => {
    if (!user) return false;
    if (!permissionOrOptions) return true;

    if (typeof permissionOrOptions === "string") {
      return evalPermission(user, permissionOrOptions);
    }

    if (Array.isArray(permissionOrOptions)) {
      return evalPermissions(user, permissionOrOptions, mode);
    }

    const opts = permissionOrOptions as UseHasPermissionOptions;
    if (opts.permissions && opts.permissions.length > 0) {
      return evalPermissions(user, opts.permissions, opts.mode || mode, opts);
    }

    if (opts.permission) {
      return evalPermission(user, opts.permission, opts);
    }

    return true;
  }, [user, permissionOrOptions, mode]);
}

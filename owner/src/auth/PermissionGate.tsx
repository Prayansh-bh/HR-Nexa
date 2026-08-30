import React from "react";
import { useHasPermission } from "./useHasPermission";
import type { PermissionKey } from "./permissions";

export interface PermissionGateProps {
  permission?: PermissionKey | string | null;
  permissions?: (PermissionKey | string)[];
  mode?: "any" | "all";
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Pure Declarative UI Component to gate child elements based on permission state.
 */
export const PermissionGate: React.FC<PermissionGateProps> = ({
  permission,
  permissions,
  mode = "all",
  fallback = null,
  children,
}) => {
  const allowed = useHasPermission(
    permissions && permissions.length > 0
      ? { permissions, mode }
      : permission,
    mode,
  );

  if (!allowed) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
};

import React from "react";
import { PermissionGate, PermissionGateProps } from "./PermissionGate";
import { Unauthorized } from "./Unauthorized";

export interface ProtectedRouteProps extends PermissionGateProps {}

/**
 * Route-level ProtectedRoute wrapper that renders <Unauthorized /> when access is forbidden.
 */
export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  permission,
  permissions,
  mode = "all",
  fallback,
  children,
}) => {
  return (
    <PermissionGate
      permission={permission}
      permissions={permissions}
      mode={mode}
      fallback={fallback || <Unauthorized />}
    >
      {children}
    </PermissionGate>
  );
};

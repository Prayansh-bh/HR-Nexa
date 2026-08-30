import { usePermissionsContext } from "./PermissionProvider";

export function usePermissions() {
  return usePermissionsContext();
}

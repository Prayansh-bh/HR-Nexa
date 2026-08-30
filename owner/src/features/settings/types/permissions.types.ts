import type { Role } from "../../../types/auth";

export interface PermissionAction {
  id: string; // e.g. "employees:list:view"
  label: string; // e.g. "View"
  description?: string;
}

export interface PermissionSubModule {
  id: string; // e.g. "employees.list"
  name: string; // e.g. "Employee List"
  actions: PermissionAction[];
}

export interface PermissionCategory {
  id: string; // e.g. "employees"
  name: string; // e.g. "Employees"
  iconName?: string;
  subModules: PermissionSubModule[];
}

export type RolePermissionMatrix = Record<Role, string[]>;

export interface PermissionMatrixFilter {
  searchQuery: string;
  selectedRole: Role;
  viewMode: "single-role" | "multi-role";
}

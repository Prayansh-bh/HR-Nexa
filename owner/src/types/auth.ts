export type Role = "SuperAdmin" | "HRAdmin" | "Manager" | "Accountant" | "Employee" | "Viewer";

export type AuthUser = {
  id?: string;
  email: string;
  name: string;
  role: Role;
  initials: string;
  subscriptionId?: string | null;
  companyId?: string | null;
  department?: string;
  permissions?: string[];
  notificationPrefs?: any;
};

export type OwnerUser = AuthUser;

export type Perm = {
  view: boolean;
  write: boolean;
  scopeToTeam?: boolean;
  scopeToSelf?: boolean;
};

export type BadgeTone =
  | "slate"
  | "indigo"
  | "rose"
  | "green"
  | "amber"
  | "sky"
  | "blue"
  | "emerald"
  | "purple"
  | "cyan"
  | "orange"
  | (string & {});

export const DEFAULT_HRADMIN_PERMISSIONS: string[] = [
  "employees:list:view",
  "employees:list:create",
  "employees:list:edit",
  "employees:list:delete",
  "employees:departments:manage",
  "employees:designations:manage",
  "employees:onboarding:manage",
  "employees:orgchart:view",
  "employees:attendance:view",
  "employees:attendance:edit",
  "employees:profile:docs:upload",
  "employees:salary:view",
  "recruitment:jobs:view",
  "recruitment:candidates:view",
  "leaves:read",
  "leaves:create",
  "leaves:approve",
  "payroll:process:view",
  "payroll:process:generate",
  "payroll:slips:view",
  "reports:payroll:view",
  "reports:attendance:view",
  "settings:company:view",
  "settings:company:edit",
  "settings:roles:view",
  "chatbox:access",
  "system:audit:view",
];

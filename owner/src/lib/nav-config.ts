import type { Role } from "../types/auth";
import { FEATURE_REGISTRY, FeatureDefinition } from "./feature-registry";
import { PERSONA_TEMPLATES } from "./persona-templates";

export type NavChild = { id: string; label: string; permission?: string };
export type NavItem = {
  id: string;
  label: string;
  icon: any;
  permission?: string;
  children?: NavChild[];
};

/**
 * Backward-compatible NAV_BY_ROLE projection generated from PERSONA_TEMPLATES + FEATURE_REGISTRY.
 */
export const NAV_BY_ROLE: Record<Role, NavItem[]> = Object.keys(PERSONA_TEMPLATES).reduce(
  (acc, roleKey) => {
    const template = PERSONA_TEMPLATES[roleKey];
    acc[roleKey as Role] = template.map((item) => {
      const feat = item.featureId ? FEATURE_REGISTRY[item.featureId] : null;
      return {
        id: item.id,
        label: item.customLabel || item.label || feat?.label || item.id,
        icon: item.icon || feat?.icon,
        permission: feat?.permission,
        children: item.children?.map((c) => {
          const cFeat = FEATURE_REGISTRY[c.featureId];
          return {
            id: c.featureId,
            label: c.customLabel || cFeat?.label || c.featureId,
            permission: cFeat?.permission,
          };
        }),
      };
    }) as NavItem[];
    return acc;
  },
  {} as Record<Role, NavItem[]>,
);

export function getPathFromId(id: string): string {
  const feat = FEATURE_REGISTRY[id];
  if (feat) return feat.route;

  switch (id) {
    case "dashboard":
      return "/dashboard";
    case "inbox":
      return "/inbox";
    case "employees":
    case "employees.list":
      return "/employees";
    case "attendance":
    case "attendance.dashboard":
      return "/attendance";
    case "leave":
    case "leave.apply":
      return "/leave/apply";
    case "payroll":
    case "payroll.structure":
      return "/payroll";
    case "documents":
    case "documents.offer":
      return "/documents";
    case "settings":
    case "settings.company":
      return "/settings";
    default:
      return "/dashboard";
  }
}

export function getIdFromPath(pathname: string): string {
  // Check exact route matches in FEATURE_REGISTRY
  const directMatch = Object.values(FEATURE_REGISTRY).find((f) => f.route === pathname);
  if (directMatch) return directMatch.id;

  // Prefix routes
  if (pathname.startsWith("/super-admin/companies")) return "saas.companies";
  if (pathname.startsWith("/super-admin/subscriptions")) return "saas.subscriptions";
  if (pathname.startsWith("/super-admin/users")) return "saas.users";
  if (pathname.startsWith("/super-admin/roles")) return "saas.roles";
  if (pathname.startsWith("/super-admin/plans")) return "saas.plans";
  if (pathname.startsWith("/super-admin/support")) return "saas.support";
  if (pathname.startsWith("/super-admin/monitoring")) return "saas.monitoring";
  if (pathname.startsWith("/super-admin/audit-logs")) return "saas.audit";
  if (pathname.startsWith("/super-admin/notifications")) return "saas.notifications";
  if (pathname.startsWith("/super-admin/billing")) return "saas.billing";
  if (pathname.startsWith("/super-admin/settings")) return "saas.settings";
  if (pathname.startsWith("/super-admin/reports")) return "saas.reports";
  if (pathname.startsWith("/super-admin/backup")) return "saas.backup";
  if (pathname.startsWith("/super-admin/recruitment")) return "saas.recruitment";
  if (pathname.startsWith("/super-admin/timeline")) return "saas.timeline";

  if (pathname.startsWith("/employees/departments")) return "employees.departments";
  if (pathname.startsWith("/employees/designations")) return "employees.designations";
  if (pathname.startsWith("/employees/onboarding")) return "employees.onboarding";
  if (pathname.startsWith("/employees/orgchart")) return "employees.orgchart";
  if (pathname.startsWith("/employees")) return "employees.list";

  if (pathname.startsWith("/attendance/manual")) return "attendance.manual";
  if (pathname.startsWith("/attendance/biometric")) return "attendance.biometric";
  if (pathname.startsWith("/attendance/geo")) return "attendance.geo";
  if (pathname.startsWith("/attendance/history")) return "attendance.history";
  if (pathname.startsWith("/attendance/matrix")) return "attendance.matrix";
  if (pathname.startsWith("/attendance/settings")) return "attendance.settings";
  if (pathname.startsWith("/attendance/self")) return "self.attendance";
  if (pathname.startsWith("/attendance")) return "attendance.dashboard";

  if (pathname.startsWith("/leave/apply")) return "leave.apply";
  if (pathname.startsWith("/leave/approvals")) return "leave.approvals";
  if (pathname.startsWith("/leave/calendar")) return "leave.calendar";
  if (pathname.startsWith("/leave/types")) return "leave.types";
  if (pathname.startsWith("/leave/reports")) return "leave.reports";
  if (pathname.startsWith("/leave/policy")) return "leave.policy";
  if (pathname.startsWith("/leave")) return "leave.apply";

  if (pathname.startsWith("/payroll/coordination")) return "payroll.coordination";
  if (pathname.startsWith("/payroll/generate")) return "payroll.generate";
  if (pathname.startsWith("/payroll/slips")) return "payroll.slips";
  if (pathname.startsWith("/payroll/history")) return "payroll.history";
  if (pathname.startsWith("/payroll/reports")) return "payroll.reports";
  if (pathname.startsWith("/payroll/process")) return "payroll.process";
  if (pathname.startsWith("/payroll/compliance")) return "payroll.compliance";
  if (pathname.startsWith("/payroll/reimbursements")) return "payroll.reimbursements";
  if (pathname.startsWith("/payroll/tax")) return "payroll.tax";
  if (pathname.startsWith("/payroll")) return "payroll.structure";

  if (pathname.startsWith("/documents/verification")) return "viewer.verification";
  if (pathname.startsWith("/documents/appointment")) return "documents.appointment";
  if (pathname.startsWith("/documents/experience")) return "documents.experience";
  if (pathname.startsWith("/documents/employee")) return "documents.employee";
  if (pathname.startsWith("/documents/compliance")) return "documents.compliance";
  if (pathname.startsWith("/documents")) return "documents.offer";

  if (pathname.startsWith("/performance/team")) return "performance.team-reviews";
  if (pathname.startsWith("/performance/cycles")) return "performance.cycles";
  if (pathname.startsWith("/performance")) return "performance.my-reviews";

  if (pathname.startsWith("/settings/timing")) return "settings.timing";
  if (pathname.startsWith("/settings/holidays")) return "settings.holidays";
  if (pathname.startsWith("/settings")) return "settings.company";

  if (pathname.startsWith("/recruitment")) return "recruitment.pipeline";
  if (pathname.startsWith("/helpdesk")) return "self.helpdesk";
  if (pathname.startsWith("/inbox")) return "inbox";
  if (pathname.startsWith("/announcements")) return "announcements";
  if (pathname.startsWith("/exit")) return "exit.resignation";
  if (pathname.startsWith("/profile")) return "profile";
  if (pathname.startsWith("/notifications")) return "notifications";
  if (pathname.startsWith("/reports/hr-analytics")) return "hr.analytics";
  if (pathname.startsWith("/reports")) return "reports";

  return "dashboard";
}

import { useNavigate } from "@tanstack/react-router";
import { useUIStore } from "../store";

export function useShellActions() {
  const navigate = useNavigate();

  const triggerConfirm = (msg: string, fn: () => void, title = "Confirm Action") => {
    useUIStore.getState().setConfirmState({
      open: true,
      title,
      message: msg,
      onConfirm: async () => {
        try {
          await fn();
        } catch {}
      },
    });
  };

  const onAddEmployee = () => {
    navigate({ to: "/employees/new" });
  };

  const onEditEmployee = (e: any) => {
    navigate({ to: `/employees/${e.id}/edit` });
  };

  const onView = (e: any) => {
    navigate({ to: `/employees/${e.id}` });
  };

  const onMessageEmployee = (e: any) => {
    navigate({ to: "/inbox" });
  };

  const onApplyLeave = () => {
    navigate({ to: "/leave/apply" });
  };

  const setActive = (id: string) => {
    const pathMap: Record<string, string> = {
      dashboard: "/dashboard",
      inbox: "/inbox",
      "employees.list": "/employees",
      "employees.departments": "/employees/departments",
      "employees.designations": "/employees/designations",
      "employees.onboarding": "/employees/onboarding",
      "employees.orgchart": "/employees/orgchart",
      "recruitment.pipeline": "/recruitment",
      "attendance.dashboard": "/attendance",
      "attendance.manual": "/attendance/manual",
      "attendance.biometric": "/attendance/biometric",
      "attendance.geo": "/attendance/geo",
      "attendance.history": "/attendance/history",
      "attendance.matrix": "/attendance/matrix",
      "attendance.settings": "/attendance/settings",
      "attendance.self": "/attendance/self",
      "self.attendance": "/attendance/self",
      "leave.apply": "/leave/apply",
      "leave.approvals": "/leave/approvals",
      "leave.calendar": "/leave/calendar",
      "leave.types": "/leave/types",
      "leave.reports": "/leave/reports",
      "leave.policy": "/leave/policy",
      "approvals.center": "/leave/approvals",
      "performance.my-reviews": "/performance",
      "performance.team-reviews": "/performance/team",
      "performance.cycles": "/performance/cycles",
      "payroll.structure": "/payroll",
      "payroll.coordination": "/payroll/coordination",
      "payroll.generate": "/payroll/generate",
      "payroll.slips": "/payroll/slips",
      "payroll.history": "/payroll/history",
      "payroll.reports": "/payroll/reports",
      "payroll.process": "/payroll/process",
      "payroll.compliance": "/payroll/compliance",
      "payroll.reimbursements": "/payroll/reimbursements",
      "payroll.tax": "/payroll/tax",
      "documents.offer": "/documents",
      "documents.compliance": "/documents/compliance",
      announcements: "/announcements",
      "self.announcements": "/announcements",
      "exit.resignation": "/exit",
      "hr.analytics": "/reports/hr-analytics",
      reports: "/reports",
      notifications: "/notifications",
      "settings.company": "/settings",
      "settings.timing": "/settings/timing",
      "settings.holidays": "/settings/holidays",
      profile: "/profile",
    };
    const toPath = pathMap[id] || `/${id.replace(/\./g, "/")}`;
    navigate({ to: toPath });
  };

  return {
    triggerConfirm,
    onAddEmployee,
    onEditEmployee,
    onView,
    onMessageEmployee,
    onApplyLeave,
    setActive,
  };
}

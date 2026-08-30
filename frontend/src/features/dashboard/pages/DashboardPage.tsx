import { useMemo, useState, useEffect } from "react";
import { getBusinessDateString } from "../../../utils/date.utils";
import {
  Users,
  CalendarCheck,
  CalendarDays,
  Wallet,
  FileText,
  BarChart3,
  Building2,
  TrendingUp,
  TrendingDown,
  Clock,
  UserPlus,
  IndianRupee,
  AlertCircle,
  ShieldCheck,
  Plus,
  CalendarPlus,
  CheckCircle2,
  XCircle,
  FolderOpen,
  FileCheck2,
  ShieldAlert,
  Info,
} from "lucide-react";
import { PageHeader, Card, Btn, Badge } from "../../../components/ui";
import { usePerformanceAnalyticsQuery } from "../../../hooks/usePerformanceQuery";
import { ROLE_LABEL, Role } from "../../auth";
import { hasPermission, PERMISSIONS } from "../../../auth";
import { useEmployeesQuery, useEmployeeQuery } from "../../../hooks/useEmployeesQuery";
import { useLeavesQuery, useLeaveQuotaQuery } from "../../../hooks/useLeavesQuery";
import { useAttendanceQuery, useAttendanceMatrixQuery } from "../../../hooks/useAttendanceQuery";
import { usePayrollQuery } from "../../../hooks/usePayrollQuery";
import { notificationService, SystemNotification } from "../../../services/notification.service";
import type { BadgeTone, Employee } from "../../../types";

export function DashboardPage(p: {
  user: any;
  setActive: (id: string) => void;
  onAddEmployee: () => void;
  onApplyLeave: () => void;
}) {
  const { user, setActive, onAddEmployee, onApplyLeave } = p;
  const { data: employeesData, employees: employeesProp } = useEmployeesQuery();
  const employees: Employee[] = Array.isArray(employeesProp) && employeesProp.length > 0
    ? employeesProp
    : (Array.isArray(employeesData)
        ? employeesData
        : (employeesData && Array.isArray((employeesData as any).data) ? (employeesData as any).data : (Array.isArray(employeesProp) ? employeesProp : [])));
  const { leaves = [] } = useLeavesQuery();
  const { records: attendanceRecords = [] } = useAttendanceQuery();

  const currentMonthMatrixStr = useMemo(
    () => new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" }),
    [],
  );
  const { data: matrixData } = useAttendanceMatrixQuery(currentMonthMatrixStr);

  const role = user.role as Role;

  const [notifications, setNotifications] = useState<SystemNotification[]>([]);
  useEffect(() => {
    notificationService
      .getSystemNotifications()
      .then((res) => {
        setNotifications(res.notifications);
      })
      .catch(console.error);
  }, []);

  // Fetch single employee profile if regular employee
  const { data: myEmployee } = useEmployeeQuery(role === "Employee" ? user.employeeId : undefined);

  // Self-scoped employee record
  const selfEmp = useMemo(() => {
    if (role === "Employee" && myEmployee) {
      return myEmployee;
    }
    return employees.find((e) => e.name === user.name || e.email === user.email);
  }, [employees, role, user, myEmployee]);

  const teamEmps = useMemo(() => {
    return employees.filter(
      (e) => e.department === user.department || (selfEmp && e.managerId === selfEmp.id),
    );
  }, [employees, user, selfEmp]);

  const { data: leaveQuotasData } = useLeaveQuotaQuery(selfEmp?.id);
  const leaveQuotas = leaveQuotasData || [];

  const { data: payrollData, slips: payrollsProp } = usePayrollQuery(
    undefined,
    role === "Employee" ? selfEmp?.id : undefined,
  );
  const payrolls =
    Array.isArray(payrollsProp) && payrollsProp.length > 0
      ? payrollsProp
      : Array.isArray(payrollData)
      ? payrollData
      : (payrollData as any)?.data || [];

  const today = getBusinessDateString();
  const currentMonthStr = getBusinessDateString().slice(0, 7);

  const totalRemainingLeaves = useMemo(() => {
    if (!leaveQuotas || leaveQuotas.length === 0) return null;
    return leaveQuotas.reduce(
      (sum: number, q: any) => sum + Math.max(0, (q.totalDays || 0) - (q.usedDays || 0)),
      0,
    );
  }, [leaveQuotas]);

  const totalAllocatedLeaves = useMemo(() => {
    if (!leaveQuotas || leaveQuotas.length === 0) return 0;
    return leaveQuotas.reduce((sum: number, q: any) => sum + (q.totalDays || 0), 0);
  }, [leaveQuotas]);

  const currentEmpPayroll = useMemo(() => {
    if (!selfEmp || !payrolls || payrolls.length === 0) return null;
    return payrolls.find(
      (p: any) =>
        (p.employeeId === selfEmp.id || p.employee === selfEmp.name) &&
        (p.month?.startsWith(currentMonthStr) || p.payPeriod?.startsWith(currentMonthStr)),
    );
  }, [selfEmp, payrolls, currentMonthStr]);

  const selfMatrixRow = useMemo(() => {
    if (!selfEmp || !matrixData?.records) return null;
    return matrixData.records.find((r: any) => r.employeeId === selfEmp.id);
  }, [selfEmp, matrixData]);

  const myMonthAttendancePct = useMemo(() => {
    if (!selfMatrixRow?.summary) return null;
    const { present = 0, late = 0, halfDay = 0, absent = 0, onLeave = 0 } = selfMatrixRow.summary;
    const completedWorkingDays = present + late + halfDay + absent + onLeave;
    if (completedWorkingDays === 0) return null;

    const presentCredit = present + late + halfDay * 0.5;
    return Math.round((presentCredit / completedWorkingDays) * 100);
  }, [selfMatrixRow]);

  const myPendingLeaves = useMemo(() => {
    if (!leaves || leaves.length === 0) return 0;
    return leaves.filter((l: any) => {
      const isMyEmp = selfEmp
        ? l.employeeId === selfEmp.id || l.employee === selfEmp.name
        : true;
      return isMyEmp && l.status === "Pending";
    }).length;
  }, [leaves, selfEmp]);

  const monthlyPayrollChartData = useMemo(() => {
    if (!payrolls || payrolls.length === 0) return [];
    const monthMap = new Map<string, number>();
    payrolls.forEach((p: any) => {
      const monthKey = (p.month || p.payPeriod || "").slice(0, 7);
      if (monthKey) {
        monthMap.set(monthKey, (monthMap.get(monthKey) || 0) + (p.netPay || 0));
      }
    });

    const sortedMonths = Array.from(monthMap.keys()).sort();
    const maxVal = Math.max(...Array.from(monthMap.values()), 1);

    return sortedMonths.slice(-6).map((m) => {
      const total = monthMap.get(m) || 0;
      const pct = Math.max(10, Math.round((total / maxVal) * 100));
      let monthName = m;
      try {
        monthName = new Date(`${m}-01`).toLocaleString("en-US", { month: "short" });
      } catch {
        // fallback to key
      }
      return { month: monthName || m, total, pct };
    });
  }, [payrolls]);

  const { presentCount, onLeaveCount, absentCount } = useMemo(() => {
    const attendanceMap = new Map<string, any>();
    (attendanceRecords || []).forEach((r: any) => {
      if (r && r.date === today) {
        attendanceMap.set(r.employeeId || r.employee, r);
      }
    });

    let present = 0;
    let onLeave = 0;
    let absent = 0;
    const isSunday = new Date(today).getDay() === 0;

    employees.forEach((emp) => {
      const record = attendanceMap.get(emp.id);
      if (record) {
        if (record.status === "Present" || record.status === "Late" || record.status === "Half Day")
          present++;
        if (record.status === "On Leave") onLeave++;
        if (record.status === "Absent") absent++;
      } else {
        if (!isSunday) absent++;
      }
    });

    return { presentCount: present, onLeaveCount: onLeave, absentCount: absent };
  }, [employees, attendanceRecords, today]);

  const stats = useMemo(() => {
    if (role === "Employee") {
      return [
        {
          label: "My Leaves Left",
          value: totalRemainingLeaves !== null ? String(totalRemainingLeaves) : "–",
          delta:
            totalRemainingLeaves !== null ? `of ${totalAllocatedLeaves} total` : "no quota allocated",
          trend: "none" as const,
          icon: CalendarDays,
          tone: "from-[color:var(--color-primary)] to-[color:var(--color-primary-glow)]",
        },
        {
          label: "This Month Net",
          value:
            currentEmpPayroll && typeof currentEmpPayroll.netPay === "number"
              ? `₹${Math.round(currentEmpPayroll.netPay).toLocaleString("en-IN")}`
              : "–",
          delta: currentEmpPayroll ? "net payout" : "payout pending",
          trend: "none" as const,
          icon: IndianRupee,
          tone: "from-[color:var(--color-success)] to-[color:var(--color-info)]",
        },
        {
          label: "Attendance %",
          value: myMonthAttendancePct !== null ? `${myMonthAttendancePct}%` : "–",
          delta: myMonthAttendancePct !== null ? "this month" : "no records",
          trend: "none" as const,
          icon: CalendarCheck,
          tone: "from-[color:var(--color-info)] to-[color:var(--color-primary)]",
        },
        {
          label: "Pending Actions",
          value: String(myPendingLeaves),
          delta: myPendingLeaves === 0 ? "all clear" : "leaves pending",
          trend: "none" as const,
          icon: AlertCircle,
          tone: "from-[color:var(--color-warning)] to-[color:var(--color-primary-glow)]",
        },
      ];
    }
    if (role === "Accountant") {
      const currentMonthPayrolls = payrolls.filter((p: any) =>
        (p.month || p.payPeriod || "").startsWith(currentMonthStr),
      );
      const hasMonthPayroll = currentMonthPayrolls.length > 0;
      const totalSpend = hasMonthPayroll
        ? currentMonthPayrolls.reduce((s: number, p: any) => s + (p.netPay || 0), 0)
        : null;
      const totalDeductions = hasMonthPayroll
        ? currentMonthPayrolls.reduce((s: number, p: any) => s + (p.deductions || 0), 0)
        : null;
      const paidTransfers = currentMonthPayrolls.filter((p: any) => p.status === "Paid").length;

      return [
        {
          label: "Payroll (MTD)",
          value: totalSpend !== null ? `₹${Math.round(totalSpend).toLocaleString("en-IN")}` : "–",
          delta: hasMonthPayroll ? "this month" : "no records",
          trend: "none" as const,
          icon: IndianRupee,
          tone: "from-[color:var(--color-info)] to-[color:var(--color-primary)]",
        },
        {
          label: "Deductions",
          value: totalDeductions !== null ? `₹${Math.round(totalDeductions).toLocaleString("en-IN")}` : "–",
          delta: hasMonthPayroll ? "this month" : "no records",
          trend: "none" as const,
          icon: TrendingDown,
          tone: "from-[color:var(--color-warning)] to-[color:var(--color-primary-glow)]",
        },
        {
          label: "Bank Transfers",
          value: hasMonthPayroll ? String(paidTransfers) : "–",
          delta: hasMonthPayroll ? "processed" : "no records",
          trend: "none" as const,
          icon: Wallet,
          tone: "from-[color:var(--color-success)] to-[color:var(--color-info)]",
        },
        {
          label: "Compliance",
          value: "100%",
          delta: "up to date",
          trend: "none" as const,
          icon: ShieldCheck,
          tone: "from-[color:var(--color-primary)] to-[color:var(--color-primary-glow)]",
        },
      ];
    }
    if (role === "Manager") {
      return [
        {
          label: "My Team",
          value: teamEmps.length,
          delta: "members",
          trend: "none" as const,
          icon: Users,
          tone: "from-[color:var(--color-primary)] to-[color:var(--color-primary-glow)]",
        },
        {
          label: "Present Today",
          value: presentCount,
          delta: "team",
          trend: "none" as const,
          icon: CalendarCheck,
          tone: "from-[color:var(--color-success)] to-[color:var(--color-info)]",
        },
        {
          label: "Absent Today",
          value: absentCount,
          delta: "team",
          trend: "none" as const,
          icon: XCircle,
          tone: "from-destructive to-[color:var(--color-warning)]",
        },
        {
          label: "Team Cost/mo",
          value: `₹${Math.round(teamEmps.reduce((s, e) => s + (e.salary || 0), 0)).toLocaleString("en-IN")}`,
          delta: "this month",
          trend: "none" as const,
          icon: IndianRupee,
          tone: "from-[color:var(--color-info)] to-[color:var(--color-primary)]",
        },
      ];
    }
    if (role === "Viewer") {
      return [
        {
          label: "Total Employees",
          value: employees.length,
          delta: "active roster",
          trend: "none" as const,
          icon: Users,
          tone: "from-[color:var(--color-primary)] to-[color:var(--color-primary-glow)]",
        },
        {
          label: "Absent Today",
          value: absentCount,
          delta: "of total",
          trend: "none" as const,
          icon: XCircle,
          tone: "from-destructive to-[color:var(--color-warning)]",
        },
        {
          label: "On Leave Today",
          value: onLeaveCount,
          delta: "of total",
          trend: "none" as const,
          icon: CalendarDays,
          tone: "from-[color:var(--color-warning)] to-[color:var(--color-primary-glow)]",
        },
        {
          label: "Departments",
          value: new Set(employees.map((e) => e.department)).size,
          delta: "active",
          trend: "none" as const,
          icon: Building2,
          tone: "from-[color:var(--color-info)] to-[color:var(--color-primary)]",
        },
      ];
    }
    // SuperAdmin & HRAdmin
    return [
      {
        label: "Total Employees",
        value: employees.length,
        delta: "active roster",
        trend: "none" as const,
        icon: Users,
        tone: "from-[color:var(--color-primary)] to-[color:var(--color-primary-glow)]",
      },
      {
        label: "Present Today",
        value: presentCount,
        delta: "today",
        trend: "none" as const,
        icon: CalendarCheck,
        tone: "from-[color:var(--color-success)] to-[color:var(--color-info)]",
      },
      {
        label: "Absent Today",
        value: absentCount,
        delta: "today",
        trend: "none" as const,
        icon: XCircle,
        tone: "from-destructive to-[color:var(--color-warning)]",
      },
      {
        label: "On Leave",
        value: onLeaveCount,
        delta: "today",
        trend: "none" as const,
        icon: CalendarDays,
        tone: "from-[color:var(--color-warning)] to-[color:var(--color-primary-glow)]",
      },
    ];
  }, [
    role,
    employees,
    leaves,
    teamEmps,
    selfEmp,
    user.department,
    presentCount,
    onLeaveCount,
    absentCount,
  ]);

  const chartData = useMemo(() => {
    const getMonday = (d: Date) => {
      const date = new Date(d);
      const day = date.getDay();
      const diff = date.getDate() - day + (day === 0 ? -6 : 1);
      const mon = new Date(date.setDate(diff));
      mon.setHours(0, 0, 0, 0);
      return mon;
    };

    const getLocalDateString = (d: Date) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    };

    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);

    const currentMonday = getMonday(todayDate);
    const weeks = [];

    // Construct last 12 weeks: W1 (11 weeks ago) to W12 (current week)
    for (let i = 11; i >= 0; i--) {
      const monday = new Date(currentMonday);
      monday.setDate(currentMonday.getDate() - i * 7);
      weeks.push(monday);
    }

    return weeks.map((monday) => {
      let presentCount = 0;
      let totalWorkdays = 0;

      // Loop through each weekday (Monday to Friday)
      for (let dayOffset = 0; dayOffset < 5; dayOffset++) {
        const currentDate = new Date(monday);
        currentDate.setDate(monday.getDate() + dayOffset);
        currentDate.setHours(0, 0, 0, 0);

        const dateStr = getLocalDateString(currentDate);

        // Skip future dates
        if (currentDate > todayDate) continue;

        employees.forEach((emp) => {
          // Skip inactive employees or employees who hadn't joined yet
          if (emp.status === "Inactive") return;
          if (emp.joined && emp.joined > dateStr) return;

          const record = attendanceRecords?.find(
            (r) => r.employeeId === emp.id && r.date === dateStr,
          );
          if (record) {
            if (record.status === "Present" || record.status === "Late") {
              presentCount++;
              totalWorkdays++;
            } else if (record.status === "Half Day") {
              presentCount += 0.5;
              totalWorkdays++;
            } else if (record.status === "Absent") {
              totalWorkdays++;
            }
          } else {
            // No record means absent on a working day
            totalWorkdays++;
          }
        });
      }

      if (totalWorkdays === 0) return 0;
      return Math.round((presentCount / totalWorkdays) * 100);
    });
  }, [employees, attendanceRecords]);

  // Role-specific quick actions
  const quickActions = useMemo(() => {
    if (role === "SuperAdmin" || role === "HRAdmin")
      return [
        {
          label: "Add Employee",
          icon: UserPlus,
          onClick: onAddEmployee,
          tone: "from-[color:var(--color-primary)] to-[color:var(--color-primary-glow)]",
        },
        {
          label: "Generate Payroll",
          icon: Wallet,
          onClick: () => setActive("payroll.generate"),
          tone: "from-[color:var(--color-info)] to-[color:var(--color-primary)]",
        },
        {
          label: "Reports",
          icon: BarChart3,
          onClick: () => setActive("reports"),
          tone: "from-[color:var(--color-warning)] to-[color:var(--color-primary-glow)]",
        },
        {
          label: "Manage Leave",
          icon: CalendarDays,
          onClick: () => setActive("leave.manage"),
          tone: "from-[color:var(--color-success)] to-[color:var(--color-info)]",
        },
      ];
    if (role === "Manager")
      return [
        {
          label: "Apply Leave",
          icon: CalendarPlus,
          onClick: onApplyLeave,
          tone: "from-[color:var(--color-success)] to-[color:var(--color-info)]",
        },
        {
          label: "Team Approvals",
          icon: CheckCircle2,
          onClick: () => setActive("leave.approvals"),
          tone: "from-[color:var(--color-warning)] to-[color:var(--color-primary-glow)]",
        },
        {
          label: "Team Slips",
          icon: Wallet,
          onClick: () => setActive("payroll.slips"),
          tone: "from-[color:var(--color-info)] to-[color:var(--color-primary)]",
        },
        {
          label: "Team Reports",
          icon: BarChart3,
          onClick: () => setActive("leave.reports"),
          tone: "from-[color:var(--color-primary)] to-[color:var(--color-primary-glow)]",
        },
      ];
    if (role === "Accountant")
      return [
        {
          label: "Process Payroll",
          icon: Wallet,
          onClick: () => setActive("payroll.process"),
          tone: "from-[color:var(--color-info)] to-[color:var(--color-primary)]",
        },
        {
          label: "Payroll Reports",
          icon: BarChart3,
          onClick: () => setActive("payroll.reports"),
          tone: "from-[color:var(--color-success)] to-[color:var(--color-info)]",
        },
        {
          label: "Salary Slips",
          icon: FileText,
          onClick: () => setActive("payroll.slips"),
          tone: "from-[color:var(--color-primary)] to-[color:var(--color-primary-glow)]",
        },
        {
          label: "Apply Leave",
          icon: CalendarPlus,
          onClick: onApplyLeave,
          tone: "from-[color:var(--color-warning)] to-[color:var(--color-primary-glow)]",
        },
      ];
    if (role === "Employee")
      return [
        {
          label: "Apply Leave",
          icon: CalendarPlus,
          onClick: onApplyLeave,
          tone: "from-[color:var(--color-success)] to-[color:var(--color-info)]",
        },
        {
          label: "My Salary Slip",
          icon: Wallet,
          onClick: () => setActive("payroll.slips"),
          tone: "from-[color:var(--color-info)] to-[color:var(--color-primary)]",
        },
        {
          label: "My Documents",
          icon: FolderOpen,
          onClick: () => setActive("documents.employee"),
          tone: "from-[color:var(--color-warning)] to-[color:var(--color-primary-glow)]",
        },
        {
          label: "My Attendance",
          icon: CalendarCheck,
          onClick: () => setActive("attendance.history"),
          tone: "from-[color:var(--color-primary)] to-[color:var(--color-primary-glow)]",
        },
      ];
    // Viewer
    return [
      {
        label: "Employee List",
        icon: Users,
        onClick: () => setActive("employees.list"),
        tone: "from-[color:var(--color-primary)] to-[color:var(--color-primary-glow)]",
      },
      {
        label: "Attendance",
        icon: CalendarCheck,
        onClick: () => setActive("attendance.dashboard"),
        tone: "from-[color:var(--color-success)] to-[color:var(--color-info)]",
      },
      {
        label: "Leave Calendar",
        icon: CalendarDays,
        onClick: () => setActive("leave.calendar"),
        tone: "from-[color:var(--color-warning)] to-[color:var(--color-primary-glow)]",
      },
      {
        label: "Reports",
        icon: BarChart3,
        onClick: () => setActive("reports"),
        tone: "from-[color:var(--color-info)] to-[color:var(--color-primary)]",
      },
    ];
  }, [role, onAddEmployee, onApplyLeave, setActive]);

  const pendingLeavesList =
    role === "Manager"
      ? leaves.filter((l) => l.status === "Pending" && l.department === user.department)
      : leaves.filter((l) => l.status === "Pending");

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome back, ${user.name.split(" ")[0]} 👋`}
        subtitle={`${ROLE_LABEL[role]} - Here's what's happening today.`}
        action={
          <>
            {hasPermission(user, PERMISSIONS.EMPLOYEES_LIST_CREATE) && (
              <Btn onClick={onAddEmployee}>
                <Plus className="h-4 w-4" /> Add Employee
              </Btn>
            )}
            {hasPermission(user, PERMISSIONS.LEAVES_REQUESTS_CREATE) && (
              <Btn variant="outline" onClick={onApplyLeave}>
                <CalendarPlus className="h-4 w-4" /> Apply Leave
              </Btn>
            )}
          </>
        }
      />

      {/* Role badge */}
      <div className="flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-4 py-2.5">
        <ShieldCheck className="h-4 w-4 text-primary shrink-0" />
        <span className="text-sm font-medium">
          You are logged in as <span className="font-bold text-primary">{ROLE_LABEL[role]}</span>
        </span>
        <span className="text-xs text-muted-foreground ml-auto hidden sm:block">
          Dashboard is customized for your role
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <Card key={s.label} className="!p-5">
              <div className="flex items-start justify-between">
                <div
                  className={`grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br ${s.tone} text-white shadow-lg`}
                >
                  <Icon className="h-5 w-5" />
                </div>
                {s.trend !== "none" ? (
                  <span
                    className={`inline-flex items-center gap-1 text-xs font-bold ${s.trend === "up" ? "text-[color:var(--color-success)]" : "text-destructive"}`}
                  >
                    {s.trend === "up" ? (
                      <TrendingUp className="h-3.5 w-3.5" />
                    ) : (
                      <TrendingDown className="h-3.5 w-3.5" />
                    )}
                    {s.delta}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
                    {s.delta}
                  </span>
                )}
              </div>
              <div className="mt-4 text-3xl font-bold tracking-tight">{s.value}</div>
              <div className="mt-1 text-sm text-muted-foreground">{s.label}</div>
            </Card>
          );
        })}
      </div>

      {/* Performance & Talent Real-Time KPI Cards */}
      {(role === "SuperAdmin" ||
        role === "HRAdmin" ||
        role === "Manager" ||
        role === "Employee") && <PerformanceKPIsSection role={role} />}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <div className="text-sm font-bold">Attendance Overview</div>
              <div className="text-xs text-muted-foreground">Last 12 weeks</div>
            </div>
            <Badge tone="indigo">Weekly</Badge>
          </div>
          <div className="flex h-48 items-end gap-2">
            {chartData.map((v, i) => (
              <div
                key={i}
                className="group flex flex-1 flex-col justify-end items-center gap-2 h-full"
                title={`Week ${i + 1}: ${v}% Attendance`}
              >
                <div
                  className="w-full rounded-t-lg btn-gradient transition-all duration-500 hover:brightness-110"
                  style={{ height: `${v}%` }}
                />
                <span className="text-[10px] text-muted-foreground">W{i + 1}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <div className="mb-4 text-sm font-bold">Quick Actions</div>
          <div className="grid grid-cols-2 gap-3">
            {quickActions.map((q) => {
              const I = q.icon;
              return (
                <button
                  key={q.label}
                  onClick={q.onClick}
                  className="group flex flex-col items-start gap-3 rounded-xl border border-border p-4 text-left transition hover:-translate-y-0.5 hover:border-primary hover:shadow-md"
                >
                  <div
                    className={`grid h-9 w-9 place-items-center rounded-lg bg-gradient-to-br ${q.tone} text-white`}
                  >
                    <I className="h-4 w-4" />
                  </div>
                  <span className="text-xs font-semibold">{q.label}</span>
                </button>
              );
            })}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Recent Activity */}
        <Card className="lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div className="text-sm font-bold">Recent Activities</div>
            <button
              onClick={() => setActive("notifications")}
              className="text-xs font-semibold text-primary hover:underline"
            >
              View all
            </button>
          </div>
          <div className="space-y-3">
            {notifications.length === 0 ? (
              <div className="text-xs text-muted-foreground py-2 text-center">
                No recent activities found.
              </div>
            ) : (
              notifications.slice(0, 5).map((n) => {
                const formatAgo = (timestamp?: string | Date) => {
                  if (!timestamp) return "Just now";
                  const diffMs = Date.now() - new Date(timestamp).getTime();
                  const mins = Math.floor(diffMs / (1000 * 60));
                  if (mins < 1) return "Just now";
                  if (mins < 60) return `${mins}m ago`;
                  const hours = Math.floor(mins / 60);
                  if (hours < 24) return `${hours}h ago`;
                  const days = Math.floor(hours / 24);
                  return `${days}d ago`;
                };

                const getIconAndTone = (severity: string) => {
                  switch (severity) {
                    case "critical":
                      return { icon: ShieldAlert, tone: "bg-rose-500" };
                    case "warning":
                      return { icon: AlertCircle, tone: "bg-amber-500" };
                    case "success":
                      return { icon: CheckCircle2, tone: "bg-emerald-500" };
                    default:
                      return { icon: Info, tone: "bg-sky-500" };
                  }
                };
                const { icon: I, tone } = getIconAndTone(n.severity);

                return (
                  <div
                    key={n.id}
                    className="flex items-center gap-3 rounded-lg p-2 transition hover:bg-muted/50 cursor-pointer"
                    onClick={() => setActive("notifications")}
                  >
                    <div
                      className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${tone} text-white`}
                    >
                      <I className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium leading-tight truncate">{n.title}</div>
                      <div className="text-xs text-muted-foreground leading-tight truncate">
                        {n.message}
                      </div>
                    </div>
                    <div className="shrink-0 text-[10px] text-muted-foreground">
                      {formatAgo(n.timestamp || n.createdAt)}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Card>

        {/* Pending Approvals or Self-service panel */}
        {role === "Employee" ? (
          <Card>
            <div className="mb-4 text-sm font-bold">My Leave Balance</div>
            <div className="space-y-3">
              {leaveQuotas.length > 0 ? (
                leaveQuotas.map((lt: any) => {
                  const remaining = Math.max(0, (lt.totalDays || 0) - (lt.usedDays || 0));
                  return (
                    <div
                      key={lt.id || lt.leaveType || lt.name}
                      className="flex items-center justify-between rounded-lg border border-border p-3"
                    >
                      <div className="text-sm font-semibold">{lt.leaveType || lt.name}</div>
                      <Badge tone="indigo">{remaining} / {lt.totalDays || 0} days</Badge>
                    </div>
                  );
                })
              ) : (
                <div className="text-xs text-muted-foreground text-center py-4">
                  No leave quotas allocated.
                </div>
              )}
              <Btn variant="outline" className="w-full justify-center" onClick={onApplyLeave}>
                <CalendarPlus className="h-4 w-4" /> Apply Leave
              </Btn>
            </div>
          </Card>
        ) : role === "Accountant" ? (
          <Card>
            <div className="mb-4 text-sm font-bold">Payroll Pipeline</div>
            <div className="space-y-3 text-sm">
              {payrolls.length > 0 ? (
                payrolls.slice(0, 3).map((c: any) => (
                  <div
                    key={c.id || c.month || c.payPeriod}
                    className="flex items-center justify-between rounded-lg border border-border p-3"
                  >
                    <span className="font-semibold">{c.month || c.payPeriod || "Period"}</span>
                    <Badge tone={c.status === "Paid" ? "green" : c.status === "Processed" ? "indigo" : "amber"}>
                      {c.status || "Draft"}
                    </Badge>
                  </div>
                ))
              ) : (
                <div className="text-xs text-muted-foreground text-center py-4">
                  No payroll records found.
                </div>
              )}
              <Btn
                className="w-full justify-center"
                onClick={() =>
                  setActive(
                    hasPermission(user, PERMISSIONS.PAYROLL_PROCESS_RUN)
                      ? "payroll.process"
                      : "payroll.generate"
                  )
                }
              >
                <Wallet className="h-4 w-4" />{" "}
                {hasPermission(user, PERMISSIONS.PAYROLL_PROCESS_RUN)
                  ? "Process Payroll"
                  : "Generate Payroll"}
              </Btn>
            </div>
          </Card>
        ) : (
          <Card>
            <div className="mb-4 flex items-center justify-between">
              <div className="text-sm font-bold">Pending Approvals</div>
              <Badge tone="amber">{pendingLeavesList.length}</Badge>
            </div>
            <div className="space-y-3">
              {pendingLeavesList.slice(0, 3).map((l) => (
                <div key={l.id} className="rounded-xl border border-border p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="text-sm font-semibold">{l.employee}</div>
                    <Badge tone="indigo">{l.days}d</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {l.type} · {l.from}
                  </div>
                  <button
                    onClick={() => setActive("leave.approvals")}
                    className="mt-2 text-xs font-semibold text-primary hover:underline"
                  >
                    Review →
                  </button>
                </div>
              ))}
              {pendingLeavesList.length === 0 && (
                <div className="text-xs text-muted-foreground text-center py-4">
                  Nothing to review.
                </div>
              )}
            </div>
          </Card>
        )}
      </div>

      {/* Super Admin Enhanced Analytics */}
      {role === "SuperAdmin" && (
        <div className="space-y-4">
          <div className="text-sm font-bold text-muted-foreground uppercase tracking-wide">
            System Analytics
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <div className="text-sm font-bold">Headcount by Department</div>
                  <div className="text-xs text-muted-foreground">Active employees</div>
                </div>
                <Badge tone="indigo">Live</Badge>
              </div>
              <div className="space-y-3">
                {Array.from(new Set(employees.map((e) => e.department))).map((dept) => {
                  const count = employees.filter(
                    (e) => e.department === dept && e.status === "Active",
                  ).length;
                  const total = employees.filter((e) => e.status === "Active").length || 1;
                  const pct = Math.round((count / total) * 100);
                  return (
                    <div key={dept}>
                      <div className="mb-1 flex justify-between text-xs">
                        <span className="font-semibold">{dept}</span>
                        <span className="text-muted-foreground">
                          {count} ({pct}%)
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full btn-gradient transition-all duration-700"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
            <Card>
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <div className="text-sm font-bold">Monthly Payroll Cost (₹)</div>
                  <div className="text-xs text-muted-foreground">Last 6 months</div>
                </div>
                <Badge tone="green">INR</Badge>
              </div>
              <div className="flex h-36 items-end gap-3 pt-4">
                {monthlyPayrollChartData.length > 0 ? (
                  monthlyPayrollChartData.map((d: any) => (
                    <div key={d.month} className="group flex flex-1 flex-col items-center gap-1">
                      <span className="text-[9px] text-muted-foreground opacity-0 group-hover:opacity-100 transition">
                        ₹{Math.round(d.total / 1000)}k
                      </span>
                      <div
                        className="w-full rounded-t-lg btn-gradient transition-all duration-500"
                        style={{ height: `${d.pct}%` }}
                      />
                      <span className="text-[10px] text-muted-foreground">{d.month}</span>
                    </div>
                  ))
                ) : (
                  <div className="w-full text-xs text-muted-foreground text-center py-8">
                    No historical payroll data available.
                  </div>
                )}
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

function PerformanceKPIsSection({ role }: { role: string }) {
  const { analytics, isLoadingAnalytics } = usePerformanceAnalyticsQuery();

  if (isLoadingAnalytics) {
    return (
      <Card className="p-5">
        <div className="text-sm text-muted-foreground animate-pulse">
          Loading performance analytics...
        </div>
      </Card>
    );
  }

  if (!analytics) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <TrendingUp className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-bold">Real-time Performance & Talent Analytics</h2>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {role === "Employee" && (
          <>
            <Card className="!p-5 bg-gradient-to-br from-primary/5 to-transparent border-primary/20">
              <div className="text-xs text-muted-foreground font-semibold">
                My Latest Appraisal Rating
              </div>
              <div className="mt-2 text-3xl font-extrabold text-primary">
                {analytics.overallRating > 0
                  ? `${analytics.overallRating.toFixed(1)} / 5.0`
                  : "No Active Rating"}
              </div>
              <div className="mt-1 text-xs text-muted-foreground font-medium">
                Updated based on latest cycle
              </div>
            </Card>

            <Card className="!p-5">
              <div className="text-xs text-muted-foreground font-semibold">
                Attendance Performance Score
              </div>
              <div className="mt-2 text-3xl font-bold text-foreground">
                {analytics.attendanceScore}%
              </div>
              <div className="mt-1 text-xs text-[color:var(--color-success)] font-bold">
                Auto-calculated from check-ins
              </div>
            </Card>

            <Card className="!p-5">
              <div className="text-xs text-muted-foreground font-semibold">
                Active Goal Progress
              </div>
              <div className="mt-2 text-3xl font-bold text-foreground">
                {analytics.goalProgress}%
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                Average completion across active KRAs
              </div>
            </Card>

            <Card className="!p-5">
              <div className="text-xs text-muted-foreground font-semibold">
                Current Appraisal Status
              </div>
              <div className="mt-2 text-lg font-bold text-foreground flex items-center gap-2">
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-indigo-500 animate-pulse"></span>
                {analytics.currentReviewStatus}
              </div>
              <div className="mt-2 text-[10px] text-muted-foreground">
                Manager feedback: "{analytics.managerFeedback.slice(0, 45)}..."
              </div>
            </Card>
          </>
        )}

        {role === "Manager" && (
          <>
            <Card className="!p-5 bg-gradient-to-br from-primary/5 to-transparent border-primary/20">
              <div className="text-xs text-muted-foreground font-semibold">Average Team Rating</div>
              <div className="mt-2 text-3xl font-extrabold text-primary">
                {analytics.avgTeamRating > 0
                  ? `${analytics.avgTeamRating.toFixed(1)} / 5.0`
                  : "No Ratings Yet"}
              </div>
              <div className="mt-1 text-xs text-muted-foreground font-medium">
                Department-wide average
              </div>
            </Card>

            <Card className="!p-5">
              <div className="text-xs text-muted-foreground font-semibold">
                Pending Appraisal Tasks
              </div>
              <div className="mt-2 text-3xl font-bold text-amber-500">
                {analytics.pendingReviews} reviews
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                Requires evaluation/self submission
              </div>
            </Card>

            <Card className="!p-5">
              <div className="text-xs text-muted-foreground font-semibold">
                Team KRA/Goal Completion
              </div>
              <div className="mt-2 text-3xl font-bold text-foreground">
                {analytics.teamGoalCompletion}%
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                Average goal progress of subordinates
              </div>
            </Card>

            <Card className="!p-5">
              <div className="text-xs text-muted-foreground font-semibold">
                Department Top Performers
              </div>
              <div className="mt-2 text-sm font-bold text-foreground space-y-1">
                <div>
                  Top:{" "}
                  <span className="text-[color:var(--color-success)]">
                    {analytics.topPerformer}
                  </span>
                </div>
                <div>
                  Needs Dev: <span className="text-rose-500">{analytics.lowestPerformer}</span>
                </div>
              </div>
            </Card>
          </>
        )}

        {(role === "SuperAdmin" || role === "HRAdmin") && (
          <>
            <Card className="!p-5 bg-gradient-to-br from-primary/5 to-transparent border-primary/20">
              <div className="text-xs text-muted-foreground font-semibold">
                Company-wide Average Rating
              </div>
              <div className="mt-2 text-3xl font-extrabold text-primary">
                {analytics.avgCompanyRating > 0
                  ? `${analytics.avgCompanyRating.toFixed(1)} / 5.0`
                  : "No Ratings Yet"}
              </div>
              <div className="mt-1 text-xs text-muted-foreground font-medium">
                Top Dept:{" "}
                <span className="font-bold text-foreground">
                  {analytics.topPerformingDepartment}
                </span>
              </div>
            </Card>

            <Card className="!p-5">
              <div className="text-xs text-muted-foreground font-semibold">
                Active Review Cycles
              </div>
              <div className="mt-2 text-3xl font-bold text-foreground">
                {analytics.activeReviews} active
              </div>
              <div className="mt-1 text-xs text-amber-500 font-bold">
                {analytics.pendingReviews} appraisals pending
              </div>
            </Card>

            <Card className="!p-5">
              <div className="text-xs text-muted-foreground font-semibold">
                Overall Attendance Integrity
              </div>
              <div className="mt-2 text-3xl font-bold text-foreground">
                {analytics.avgAttendance}%
              </div>
              <div className="mt-1 text-xs text-[color:var(--color-success)] font-bold">
                Auto-contributes to appraisals
              </div>
            </Card>

            <Card className="!p-5">
              <div className="text-xs text-muted-foreground font-semibold">Key Talent Metrics</div>
              <div className="mt-2 text-sm font-bold text-foreground space-y-1">
                <div>
                  Promotion Pool:{" "}
                  <span className="text-indigo-500">
                    {analytics.promotionCandidates} candidates
                  </span>
                </div>
                <div>
                  Training Recs:{" "}
                  <span className="text-amber-500">{analytics.trainingRecommended} candidates</span>
                </div>
              </div>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}

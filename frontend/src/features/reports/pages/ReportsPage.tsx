import { useState } from "react";
import { getBusinessDateString } from "../../../utils/date.utils";
import { Download, BarChart3, Users, CalendarCheck, CalendarDays, PieChart } from "lucide-react";
import { PageHeader, Card, Btn, Badge, Row, inputCls } from "../../../components/ui";
import type { Employee, LeaveRequest } from "../../../types";
import { downloadCSV } from "../../../lib/csv-export";
import { useEmployeesQuery } from "../../../hooks/useEmployeesQuery";
import { useLeavesQuery } from "../../../hooks/useLeavesQuery";
import { useAttendanceQuery } from "../../../hooks/useAttendanceQuery";

export function ReportsPage(p: { setActive: (id: string) => void; toast: any }) {
  const { setActive, toast } = p;
  const { data: employeesData, employees: employeesProp } = useEmployeesQuery();
  const employees: Employee[] = Array.isArray(employeesProp) && employeesProp.length > 0
    ? employeesProp
    : (Array.isArray(employeesData)
        ? employeesData
        : (employeesData && Array.isArray((employeesData as any).data) ? (employeesData as any).data : (Array.isArray(employeesProp) ? employeesProp : [])));
  const { leaves = [] } = useLeavesQuery();
  const { records: attendanceRecords = [] } = useAttendanceQuery();
  const [reportType, setReportType] = useState<"general" | "demographics" | "attendance" | "leave">(
    "general",
  );
  const [selectedMonth, setSelectedMonth] = useState("August 2026");

  const months = ["August 2026", "July 2026", "June 2026", "May 2026"];
  const monthMap: Record<string, string> = {
    "August 2026": "2026-08",
    "July 2026": "2026-07",
    "June 2026": "2026-06",
    "May 2026": "2026-05",
  };
  const currentMonthPrefix = monthMap[selectedMonth] || "2026-08";

  // Filter datasets by selected month
  const filteredLeaves = leaves.filter((l) => l.from.startsWith(currentMonthPrefix));
  const filteredAttendance = attendanceRecords.filter((r) => r.date.startsWith(currentMonthPrefix));

  // Metrics
  const activeCount = employees.filter((e) => e.status === "Active").length;
  const totalSalary = employees.reduce((s, e) => s + (e.status === "Active" && e.salary ? e.salary : 0), 0);
  const pendingLeaves = filteredLeaves.filter((l) => l.status === "Pending").length;

  // Calculate average attendance for current day
  const todayStr = getBusinessDateString();
  const presentToday = attendanceRecords.filter(
    (r) => r.date === todayStr && r.status === "Present",
  ).length;

  const exportEmployeeDirectory = () => {
    const headers = [
      "Employee ID",
      "Name",
      "Email",
      "Department",
      "Designation",
      "Status",
      "Joined Date",
      "Monthly Salary",
      "Phone",
      "Address",
      "Gender",
    ];
    const rows = employees.map((e) => [
      e.id,
      `"${e.name.replace(/"/g, '""')}"`,
      e.email,
      e.department,
      e.designation,
      e.status,
      e.joined,
      e.salary,
      `"${e.phone || ""}"`,
      `"${(e.address || "").replace(/"/g, '""')}"`,
      e.gender || "",
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    downloadCSV("employee_directory.csv", csv);
    toast("Employee Directory exported successfully");
  };

  const exportAttendanceLog = () => {
    const headers = [
      "Record ID",
      "Employee ID",
      "Employee Name",
      "Date",
      "Check In",
      "Check Out",
      "Status",
      "Verification",
    ];
    const rows = (filteredAttendance || []).map((r) => [
      r.id,
      r.employeeId,
      `"${(r.employeeName || "").replace(/"/g, '""')}"`,
      r.date,
      r.checkIn,
      r.checkOut,
      r.status,
      r.verificationType,
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    downloadCSV(`attendance_log_${currentMonthPrefix}.csv`, csv);
    toast("Attendance log exported successfully");
  };

  const exportLeaveRecords = () => {
    const headers = [
      "Request ID",
      "Employee Name",
      "Leave Type",
      "From Date",
      "To Date",
      "Days Count",
      "Reason",
      "Status",
      "Department",
    ];
    const rows = filteredLeaves.map((l) => [
      l.id,
      `"${l.employee.replace(/"/g, '""')}"`,
      l.type,
      l.from,
      l.to,
      l.days,
      `"${(l.reason || "").replace(/"/g, '""')}"`,
      l.status,
      l.department || "",
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    downloadCSV(`leave_records_${currentMonthPrefix}.csv`, csv);
    toast("Leave records exported successfully");
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Company Reports"
        subtitle="Analyze organizational stats, download directories, and track metrics."
        action={
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className={inputCls + " w-40"}
          >
            {months.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        }
      />

      <div className="flex gap-2 border-b border-border pb-4 overflow-x-auto">
        {[
          { id: "general", label: "Reports Overview", icon: BarChart3 },
          { id: "demographics", label: "Demographics & HR", icon: Users },
          { id: "attendance", label: "Attendance Summary", icon: CalendarCheck },
          { id: "leave", label: "Leaves & Utilization", icon: CalendarDays },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setReportType(tab.id as any)}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold whitespace-nowrap transition ${
                reportType === tab.id
                  ? "btn-gradient text-white"
                  : "text-muted-foreground bg-card border border-border hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {reportType === "general" && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                label: "Active Employees",
                value: String(activeCount),
                sub: `${employees.length} total headcount`,
              },
              {
                label: "Monthly Base Payroll",
                value: `₹${totalSalary.toLocaleString()}`,
                sub: "Excluding LOP & Overtime",
              },
              {
                label: "Pending Leave Requests",
                value: String(pendingLeaves),
                sub: "Requires manager approvals",
              },
              {
                label: "Attendance Today",
                value: String(presentToday),
                sub: "Present / Checked In",
              },
            ].map((kpi, idx) => (
              <Card
                key={idx}
                className="!p-4 bg-gradient-to-br from-card to-muted/20 border-border"
              >
                <div className="text-2xl font-bold">{kpi.value}</div>
                <div className="text-sm font-semibold text-foreground mt-1">{kpi.label}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{kpi.sub}</div>
              </Card>
            ))}
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <Card className="space-y-4">
              <h3 className="font-bold text-lg border-b border-border pb-2 flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" /> Directory & Demographics
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Export the complete employee profile directory containing contact information, bank
                accounts, Aadhaar details, designations, and join dates.
              </p>
              <div className="pt-2 flex gap-3">
                <Btn onClick={exportEmployeeDirectory} className="w-full justify-center">
                  <Download className="h-4 w-4" /> Export CSV Directory
                </Btn>
                <Btn
                  variant="outline"
                  onClick={() => setReportType("demographics")}
                  className="w-full justify-center"
                >
                  View Analytics
                </Btn>
              </div>
            </Card>

            <Card className="space-y-4">
              <h3 className="font-bold text-lg border-b border-border pb-2 flex items-center gap-2">
                <CalendarCheck className="h-5 w-5 text-primary" /> Attendance Logs
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Analyze daily check-in patterns, check list of late entries, absent lists, and
                download logs for specific billing periods.
              </p>
              <div className="pt-2 flex gap-3">
                <Btn onClick={exportAttendanceLog} className="w-full justify-center">
                  <Download className="h-4 w-4" /> Export Attendance CSV
                </Btn>
                <Btn
                  variant="outline"
                  onClick={() => setReportType("attendance")}
                  className="w-full justify-center"
                >
                  View Stats
                </Btn>
              </div>
            </Card>

            <Card className="space-y-4">
              <h3 className="font-bold text-lg border-b border-border pb-2 flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-primary" /> Leave Records
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Check department-wise leaves utilization, analyze seasonal leave patterns, and
                export leave logs for statutory records.
              </p>
              <div className="pt-2 flex gap-3">
                <Btn onClick={exportLeaveRecords} className="w-full justify-center">
                  <Download className="h-4 w-4" /> Export Leaves CSV
                </Btn>
                <Btn
                  variant="outline"
                  onClick={() => setReportType("leave")}
                  className="w-full justify-center"
                >
                  View Utilization
                </Btn>
              </div>
            </Card>

            <Card className="space-y-4">
              <h3 className="font-bold text-lg border-b border-border pb-2 flex items-center gap-2">
                <PieChart className="h-5 w-5 text-primary" /> Statutory Payroll Reports
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Access PF return files, ESI statements, TDS Form 24Q sheets, bank salary transfer
                sheets, and department CTC breakdowns.
              </p>
              <div className="pt-2">
                <Btn
                  onClick={() => setActive("payroll.reports")}
                  className="w-full justify-center btn-gradient"
                >
                  Go to Payroll Reports
                </Btn>
              </div>
            </Card>
          </div>
        </>
      )}

      {reportType === "demographics" && (
        <Card className="space-y-6">
          <div className="flex justify-between items-center border-b border-border pb-3">
            <div>
              <h3 className="font-bold text-lg">Department Distributions</h3>
              <p className="text-xs text-muted-foreground">
                Headcount allocation by business division
              </p>
            </div>
            <Btn onClick={exportEmployeeDirectory} size="sm" variant="outline">
              <Download className="h-4 w-4" /> Export CSV
            </Btn>
          </div>
          <div className="space-y-4">
            {Array.from(new Set(employees.map((e) => e.department))).map((dept) => {
              const deptEmps = employees.filter((e) => e.department === dept);
              const percentage = Math.round((deptEmps.length / employees.length) * 100);
              return (
                <div key={dept} className="space-y-1">
                  <div className="flex justify-between text-sm font-semibold">
                    <span>{dept}</span>
                    <span className="text-muted-foreground">
                      {deptEmps.length} employee(s) ({percentage}%)
                    </span>
                  </div>
                  <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                    <div className="h-full btn-gradient" style={{ width: `${percentage}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {reportType === "attendance" && (
        <Card className="space-y-6">
          <div className="flex justify-between items-center border-b border-border pb-3">
            <div>
              <h3 className="font-bold text-lg">Attendance Patterns</h3>
              <p className="text-xs text-muted-foreground">
                Summary of employee attendance statuses
              </p>
            </div>
            <Btn onClick={exportAttendanceLog} size="sm" variant="outline">
              <Download className="h-4 w-4" /> Export CSV
            </Btn>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              {
                label: "Present Records",
                value: String(filteredAttendance.filter((r) => r.status === "Present").length),
                tone: "green",
              },
              {
                label: "Absent Records",
                value: String(filteredAttendance.filter((r) => r.status === "Absent").length),
                tone: "rose",
              },
              {
                label: "Late Check-ins",
                value: String(filteredAttendance.filter((r) => r.lateCheckIn).length),
                tone: "amber",
              },
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded-xl border border-border p-4 bg-muted/20 text-center"
              >
                <div className="text-3xl font-extrabold">{stat.value}</div>
                <div className="text-xs text-muted-foreground mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {reportType === "leave" && (
        <Card className="space-y-6">
          <div className="flex justify-between items-center border-b border-border pb-3">
            <div>
              <h3 className="font-bold text-lg">Leave Status Allocation</h3>
              <p className="text-xs text-muted-foreground">Leaves request breakdown by status</p>
            </div>
            <Btn onClick={exportLeaveRecords} size="sm" variant="outline">
              <Download className="h-4 w-4" /> Export CSV
            </Btn>
          </div>
          <div className="space-y-4">
            {[
              {
                status: "Approved",
                count: filteredLeaves.filter((l) => l.status === "Approved").length,
                tone: "green",
              },
              {
                status: "Pending",
                count: filteredLeaves.filter((l) => l.status === "Pending").length,
                tone: "amber",
              },
              {
                status: "Rejected",
                count: filteredLeaves.filter((l) => l.status === "Rejected").length,
                tone: "rose",
              },
            ].map((item) => {
              const total = filteredLeaves.length || 1;
              const percentage = Math.round((item.count / total) * 100);
              return (
                <div key={item.status} className="space-y-1">
                  <div className="flex justify-between text-sm font-semibold">
                    <Badge tone={item.tone}>{item.status}</Badge>
                    <span className="text-muted-foreground">
                      {item.count} request(s) ({percentage}%)
                    </span>
                  </div>
                  <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full ${item.status === "Approved" ? "bg-[color:var(--color-success)]" : item.status === "Pending" ? "bg-[color:var(--color-warning)]" : "bg-destructive"}`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}

import { useState, useEffect } from "react";
import { getBusinessDateString } from "../../../utils/date.utils";
import { hasPermission, isSuperAdmin, PERMISSIONS } from "../../../auth";
import { Plus, Check, X, Download, CalendarDays, CalendarPlus, Trash2 } from "lucide-react";
import {
  PageHeader,
  Card,
  Btn,
  Badge,
  Avatar,
  Field,
  ReadOnlyBanner,
  ModalShell,
  inputCls,
  dateInputProps,
} from "../../../components/ui";
import { printHTML } from "../../../lib/pdf-export";
import { downloadCSV } from "../../../lib/csv-export";
import { calcAllDepartmentsUtilization } from "../../../domain/leave/leaveUtilization";
import type { LeaveRequest, LeaveType, Employee, BadgeTone } from "../../../types";
import { useEmployeesQuery } from "../../../hooks/useEmployeesQuery";
import { useAttendanceQuery } from "../../../hooks/useAttendanceQuery";
import {
  useLeavesQuery,
  useLeaveTypesQuery,
  useLeaveEventsQuery,
  useLeaveMutations,
} from "../../../hooks/useLeavesQuery";
import { attendanceService } from "../../../services/attendance.service";
import { useUIStore } from "../../../store";

function LeaveTypesPage({
  leaveTypes,
  canEdit,
  toast,
  triggerConfirm,
}: {
  leaveTypes: LeaveType[];
  canEdit: boolean;
  toast: (m: string) => void;
  triggerConfirm: (msg: string, fn: () => void, title?: string) => void;
}) {
  const { createLeaveType, deleteLeaveType } = useLeaveMutations();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState<{ name: string; days: number; tone: BadgeTone }>({
    name: "",
    days: 10,
    tone: "indigo",
  });
  const save = async () => {
    if (!f.name.trim()) return;
    try {
      await createLeaveType.mutateAsync({ name: f.name.trim(), days: f.days, tone: f.tone });
      toast("Leave type added");
      setOpen(false);
      setF({ name: "", days: 10, tone: "indigo" });
    } catch (err: any) {
      toast(err?.message || "Failed to create leave type");
    }
  };
  const handleDelete = (name: string) => {
    triggerConfirm(
      `Delete leave type "${name}"? This cannot be undone.`,
      async () => {
        try {
          await deleteLeaveType.mutateAsync(name);
          toast(`Leave type "${name}" deleted`);
        } catch (err: any) {
          toast(err?.message || "Failed to delete leave type");
        }
      },
      "Delete Leave Type",
    );
  };
  return (
    <div>
      {!canEdit && <ReadOnlyBanner />}
      <PageHeader
        title="Leave Types"
        subtitle="Configure your organization's leave policy."
        action={
          canEdit && (
            <Btn onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4" /> New Leave Type
            </Btn>
          )
        }
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {leaveTypes.map((t) => (
          <Card key={t.name}>
            <div className="flex items-start justify-between">
              <div>
                <div className="font-bold">{t.name}</div>
                <div className="mt-1 text-xs text-muted-foreground">Annual allowance</div>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone={t.tone}>{t.days} days</Badge>
                {canEdit && (
                  <button
                    onClick={() => handleDelete(t.name)}
                    title="Delete leave type"
                    className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>
      {open && (
        <ModalShell title="New Leave Type" onClose={() => setOpen(false)}>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field className="md:col-span-2" label="Name *">
              <input
                value={f.name}
                onChange={(e) => setF({ ...f, name: e.target.value })}
                className={inputCls}
                placeholder="e.g. Bereavement"
              />
            </Field>
            <Field label="Days">
              <input
                type="number"
                value={f.days}
                onChange={(e) => setF({ ...f, days: Number(e.target.value) })}
                className={inputCls}
              />
            </Field>
            <Field label="Color">
              <select
                value={f.tone}
                onChange={(e) => setF({ ...f, tone: e.target.value as BadgeTone })}
                className={inputCls}
              >
                {(["indigo", "green", "amber", "rose", "sky", "slate"] as BadgeTone[]).map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </Field>
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <Btn variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Btn>
            <Btn onClick={save}>Create</Btn>
          </div>
        </ModalShell>
      )}
    </div>
  );
}

function LeaveCalendar({
  leaves,
  isSelf,
  toast,
}: {
  leaves: LeaveRequest[];
  isSelf?: boolean;
  toast: (m: string) => void;
}) {
  const { data: eventsData } = useLeaveEventsQuery();
  const events = eventsData || [];
  const { createEvent, deleteEvent } = useLeaveMutations();
  const [currentYear, setCurrentYear] = useState(2026);
  const [currentMonth, setCurrentMonth] = useState(7); // August 2026
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [newEvent, setNewEvent] = useState({
    date: getBusinessDateString(),
    title: "",
    type: "meeting" as const,
  });

  const [weekOffs, setWeekOffs] = useState<string[]>(["Sunday"]);

  useEffect(() => {
    let active = true;
    async function loadSettings() {
      try {
        const res = await attendanceService.getSettings();
        if (res && res.weekOffs && active) {
          setWeekOffs(res.weekOffs.split(",").map((day: string) => day.trim()));
        }
      } catch (err) {
        console.error("Failed to load attendance settings for calendar:", err);
      }
    }
    void loadSettings();
    return () => {
      active = false;
    };
  }, []);

  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay();
  const numDays = new Date(currentYear, currentMonth + 1, 0).getDate();
  const calendarCells: (number | null)[] = [];
  for (let i = 0; i < firstDayIndex; i++) calendarCells.push(null);
  for (let d = 1; d <= numDays; d++) calendarCells.push(d);

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((prev) => prev - 1);
    } else setCurrentMonth((prev) => prev - 1);
  };
  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((prev) => prev + 1);
    } else setCurrentMonth((prev) => prev + 1);
  };

  const getEventsForDay = (day: number) => {
    const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const date = new Date(currentYear, currentMonth, day);
    const weekdayName = date.toLocaleDateString("en-US", { weekday: "long" });
    const isWeekOff = weekOffs.includes(weekdayName);

    const dayLeaves = leaves
      .filter((l) => l.status === "Approved" && dateStr >= l.from && dateStr <= l.to)
      .map((l) => ({ title: `${l.employee} (Leave)`, type: "leave" as const }));
    const dayEvents = events
      .filter((e) => e.date === dateStr)
      .map((e) => ({ title: e.title, type: e.type }));
    if (isWeekOff && !dayEvents.some((e) => e.type === "holiday")) {
      dayEvents.push({ title: `${weekdayName} Off`, type: "holiday" as const });
    }
    return [...dayLeaves, ...dayEvents];
  };

  return (
    <div>
      <PageHeader
        title={isSelf ? "My Leave Calendar" : "Leave Calendar"}
        subtitle={`${monthNames[currentMonth]} ${currentYear}`}
        action={
          <div className="flex gap-2">
            <Btn variant="outline" size="sm" onClick={handlePrevMonth}>
              Prev
            </Btn>
            <Btn variant="outline" size="sm" onClick={handleNextMonth}>
              Next
            </Btn>
            <Btn size="sm" onClick={() => setShowAddEvent(true)}>
              <Plus className="h-4 w-4" /> Add Event
            </Btn>
          </div>
        }
      />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        <Card className="lg:col-span-3">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex gap-2">
              <select
                value={currentMonth}
                onChange={(e) => setCurrentMonth(Number(e.target.value))}
                className={inputCls + " text-xs py-1 w-28"}
              >
                {monthNames.map((m, idx) => (
                  <option key={idx} value={idx}>
                    {m}
                  </option>
                ))}
              </select>
              <select
                value={currentYear}
                onChange={(e) => setCurrentYear(Number(e.target.value))}
                className={inputCls + " text-xs py-1 w-20"}
              >
                {[2024, 2025, 2026, 2027, 2028].map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-3 text-xs flex-wrap">
              <span className="flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-full bg-red-500" /> Leave
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-full bg-blue-500" /> Holiday
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-full bg-green-500" /> Meeting
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-full bg-purple-500" /> Event
              </span>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-2 text-xs">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div key={d} className="pb-2 text-center font-bold text-muted-foreground">
                {d}
              </div>
            ))}
            {calendarCells.map((d, idx) => {
              if (d === null)
                return (
                  <div
                    key={`empty-${idx}`}
                    className="aspect-square rounded-lg border border-transparent"
                  />
                );
              const dayEvents = getEventsForDay(d);
              const isToday =
                new Date().getDate() === d &&
                new Date().getMonth() === currentMonth &&
                new Date().getFullYear() === currentYear;
              return (
                <div
                  key={d}
                  className={`aspect-square rounded-lg border p-1 hover:border-primary/50 transition flex flex-col justify-between overflow-hidden min-h-[70px] ${isToday ? "border-primary bg-primary/5" : "border-border"}`}
                >
                  <div className="text-sm font-semibold">{d}</div>
                  <div className="flex flex-col gap-0.5 mt-1 overflow-y-auto max-h-[80%]">
                    {dayEvents.map((e, eidx) => (
                      <span
                        key={eidx}
                        className={`text-[8px] truncate px-1 rounded-sm text-white font-medium ${e.type === "leave" ? "bg-red-500" : e.type === "holiday" ? "bg-blue-500" : e.type === "meeting" ? "bg-green-500" : "bg-purple-500"}`}
                        title={e.title}
                      >
                        {e.title}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
        <Card>
          <div className="text-sm font-bold mb-4">Upcoming Schedule</div>
          <div className="space-y-3">
            {events
              .filter((e) =>
                e.date.startsWith(`${currentYear}-${String(currentMonth + 1).padStart(2, "0")}`),
              )
              .map((e, idx) => (
                <div
                  key={e.id || idx}
                  className="p-2.5 border border-border rounded-lg text-xs flex justify-between items-center bg-muted/20 gap-2"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold truncate">{e.title}</div>
                    <div className="text-muted-foreground mt-0.5">{e.date}</div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Badge
                      tone={
                        e.type === "holiday"
                          ? "sky"
                          : e.type === "meeting"
                            ? "green"
                            : e.type === "event"
                              ? "indigo"
                              : "rose"
                      }
                    >
                      {e.type}
                    </Badge>
                    {!isSelf && (
                      <button
                        onClick={() => {
                          useUIStore.getState().setConfirmState({
                            open: true,
                            title: "Delete Calendar Event",
                            message: `Are you sure you want to delete the event "${e.title}"?`,
                            confirmText: "Delete Event",
                            cancelText: "Cancel",
                            confirmVariant: "danger",
                            onConfirm: async () => {
                              try {
                                await deleteEvent.mutateAsync(e.id);
                                toast("Event deleted successfully");
                              } catch (err: any) {
                                toast(err?.message || "Failed to delete event");
                              }
                            },
                          });
                        }}
                        className="text-muted-foreground hover:text-destructive p-1 rounded transition hover:bg-destructive/10 cursor-pointer"
                        title="Delete event"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            {events.filter((e) =>
              e.date.startsWith(`${currentYear}-${String(currentMonth + 1).padStart(2, "0")}`),
            ).length === 0 && (
              <div className="text-xs text-muted-foreground text-center py-6">
                No scheduled events.
              </div>
            )}
          </div>
        </Card>
      </div>
      {showAddEvent && (
        <ModalShell title="Add Event to Calendar" onClose={() => setShowAddEvent(false)}>
          <div className="space-y-4">
            <Field label="Event Title *">
              <input
                value={newEvent.title}
                onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                className={inputCls}
                placeholder="e.g. Town Hall Meeting"
              />
            </Field>
            <Field label="Date">
              <input
                type="date"
                value={newEvent.date}
                onChange={(e) => setNewEvent({ ...newEvent, date: e.target.value })}
                className={inputCls}
              />
            </Field>
            <Field label="Type">
              <select
                value={newEvent.type}
                onChange={(e) => setNewEvent({ ...newEvent, type: e.target.value as any })}
                className={inputCls}
              >
                <option value="meeting">Meeting</option>
                <option value="event">Event</option>
              </select>
            </Field>
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <Btn variant="outline" onClick={() => setShowAddEvent(false)}>
              Cancel
            </Btn>
            <Btn
              onClick={async () => {
                if (!newEvent.title.trim()) return;
                try {
                  await createEvent.mutateAsync(newEvent);
                  toast("Event added to calendar");
                  setShowAddEvent(false);
                  setNewEvent({
                    date: getBusinessDateString(),
                    title: "",
                    type: "meeting",
                  });
                } catch (err: any) {
                  toast(err?.message || "Failed to add event");
                }
              }}
            >
              Add
            </Btn>
          </div>
        </ModalShell>
      )}
    </div>
  );
}

function LeaveReportsPage({
  leaves,
  employees,
  scopeToTeam,
  userDept,
  attendanceRecords,
}: {
  leaves: LeaveRequest[];
  employees: Employee[];
  scopeToTeam: boolean;
  userDept?: string;
  attendanceRecords?: any[];
}) {
  const visibleLeaves =
    scopeToTeam && userDept ? leaves.filter((l) => l.department === userDept) : leaves;
  const visibleEmployees =
    scopeToTeam && userDept ? employees.filter((e) => e.department === userDept) : employees;
  const utilization = calcAllDepartmentsUtilization(visibleEmployees, attendanceRecords);

  const exportPDF = () => {
    const html = `<html><head><title>Leave Reports</title><style>body { font-family: sans-serif; padding: 20px; } table { width:100%; border-collapse:collapse; margin-top:20px; } th, td { border:1px solid #ddd; padding:8px; text-align:left; }</style></head><body><h1>Leave Utilization Report</h1><p>Generated on ${new Date().toLocaleString()}</p><table><thead><tr><th>Department</th><th>Total</th><th>Present</th><th>Absent</th><th>On Leave</th><th>Half Day</th><th>Status</th></tr></thead><tbody>${utilization.map((u) => `<tr><td>${u.dept}</td><td>${u.total}</td><td>${u.present}</td><td>${u.absent}</td><td>${u.onLeave}</td><td>${u.halfDay}</td><td>${u.leavePercent}% - ${u.statusText}</td></tr>`).join("")}</tbody></table><script>window.onload=()=>window.print()</script></body></html>`;
    printHTML(html);
  };

  const exportExcel = () => {
    let csv = "Department,Total,Present,Absent,On Leave,Half Day,Leave %,Status\n";
    utilization.forEach((u) => {
      csv += `"${u.dept}",${u.total},${u.present},${u.absent},${u.onLeave},${u.halfDay},${u.leavePercent}%,${u.statusText}\n`;
    });
    downloadCSV("leave_utilization_report.csv", csv);
  };

  return (
    <div>
      <PageHeader
        title={scopeToTeam ? "Team Leave Reports" : "Leave Reports"}
        subtitle="Utilization, balances, and carry-forward."
      />
      <div className="grid gap-4 sm:grid-cols-3 mb-4">
        {[
          {
            label: "Total Approved",
            value: visibleLeaves
              .filter((l) => l.status === "Approved")
              .reduce((s, l) => s + l.days, 0),
            tone: "green" as BadgeTone,
          },
          {
            label: "Pending Days",
            value: visibleLeaves
              .filter((l) => l.status === "Pending")
              .reduce((s, l) => s + l.days, 0),
            tone: "amber" as BadgeTone,
          },
          {
            label: "Rejected",
            value: visibleLeaves.filter((l) => l.status === "Rejected").length,
            tone: "rose" as BadgeTone,
          },
        ].map((s) => (
          <Card key={s.label} className="!p-4">
            <div className="text-2xl font-bold">{s.value}</div>
            <div className="mt-1 flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{s.label}</span>
              <Badge tone={s.tone}>{s.label.split(" ")[0]}</Badge>
            </div>
          </Card>
        ))}
      </div>
      <Card className="!p-0 overflow-hidden mb-6">
        <div className="border-b border-border px-4 py-3 text-sm font-bold">
          Department-wise Utilization
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left text-xs uppercase text-muted-foreground">
                <th className="px-4 py-3">Department</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3">Present</th>
                <th className="px-4 py-3">Absent</th>
                <th className="px-4 py-3">On Leave</th>
                <th className="px-4 py-3">Half Day</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {utilization.map((u) => (
                <tr key={u.dept} className="border-b border-border/60">
                  <td className="px-4 py-3 font-semibold">{u.dept}</td>
                  <td className="px-4 py-3">{u.total}</td>
                  <td className="px-4 py-3">{u.present}</td>
                  <td className="px-4 py-3">{u.absent}</td>
                  <td className="px-4 py-3">{u.onLeave}</td>
                  <td className="px-4 py-3">{u.halfDay}</td>
                  <td className="px-4 py-3">
                    <Badge tone={u.statusTone} className="flex items-center gap-1 w-max">
                      <span className="h-2 w-2 rounded-full bg-current opacity-80" />
                      {u.leavePercent}% - {u.statusText}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <div className="mt-4 flex justify-end gap-2">
        <Btn variant="outline" onClick={exportPDF}>
          <Download className="h-4 w-4" /> Export PDF
        </Btn>
        <Btn variant="outline" onClick={exportExcel}>
          <Download className="h-4 w-4" /> Export Excel
        </Btn>
      </div>
    </div>
  );
}

import { PaginationControls } from "../../../components/ui/PaginationControls";

export function LeavePage(p: {
  sub: string;
  user: any;
  toast: any;
  triggerConfirm: any;
  onApplyLeave: () => void;
  setActive: (id: string) => void;
}) {
  const { sub, onApplyLeave, user, toast, triggerConfirm } = p;
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);

  const showPending = sub === "leave.approvals";
  const showManage = sub === "leave.manage";

  const {
    leaves = [],
    total = 0,
    totalPages = 0,
  } = useLeavesQuery({
    status: showPending ? "PENDING" : undefined,
    page,
    limit: pageSize,
  });

  useEffect(() => {
    setPage(1);
  }, [sub]);

  useEffect(() => {
    if (page > totalPages && totalPages > 0) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const { data: leaveTypesData } = useLeaveTypesQuery();
  const defaultLeaveTypes: LeaveType[] = [
    { name: "Casual Leave", days: 12, tone: "indigo" },
    { name: "Sick Leave", days: 10, tone: "rose" },
    { name: "Annual Leave", days: 15, tone: "green" },
  ];
  const leaveTypes = leaveTypesData && leaveTypesData.length > 0 ? leaveTypesData : defaultLeaveTypes;
  const { data: employeesData, employees: employeesProp } = useEmployeesQuery();
  const employees: Employee[] = Array.isArray(employeesProp) && employeesProp.length > 0
    ? employeesProp
    : (Array.isArray(employeesData)
        ? employeesData
        : (employeesData && Array.isArray((employeesData as any).data) ? (employeesData as any).data : (Array.isArray(employeesProp) ? employeesProp : [])));
  const { records: attendanceRecords = [] } = useAttendanceQuery();
  const canEdit = hasPermission(user, PERMISSIONS.LEAVES_REQUESTS_APPROVE) || isSuperAdmin(user);
  const canApprove = hasPermission(user, PERMISSIONS.LEAVES_REQUESTS_APPROVE) || isSuperAdmin(user);
  const scopeToTeam = user.role === "Manager";
  const scopeToSelf = user.role === "Employee";
  const { updateLeaveStatus } = useLeaveMutations();

  if (sub === "leave.calendar")
    return (
      <LeaveCalendar
        leaves={scopeToSelf ? leaves.filter((l) => l.employee === user.name) : leaves}
        isSelf={!!scopeToSelf}
        toast={toast}
      />
    );
  if (sub === "leave.types")
    return (
      <LeaveTypesPage
        leaveTypes={leaveTypes}
        canEdit={canEdit}
        toast={toast}
        triggerConfirm={triggerConfirm}
      />
    );
  if (sub === "leave.reports")
    return (
      <LeaveReportsPage
        leaves={leaves}
        employees={employees}
        scopeToTeam={!!scopeToTeam}
        userDept={user.department}
        attendanceRecords={attendanceRecords}
      />
    );
  if (sub === "leave.apply") return <ApplyLeavePage leaveTypes={leaveTypes} toast={toast} />;

  const visibleLeaves = scopeToTeam
    ? leaves.filter((l) => l.department === user.department)
    : leaves;
  const pending = visibleLeaves.filter(
    (l) => l.status === "Pending" && (canApprove || l.employee !== user.name),
  );

  let pageTitle = "Leave Requests";
  if (showPending) pageTitle = scopeToTeam ? "Team Leave Approvals" : "Leave Approvals";
  if (showManage) pageTitle = "Manage Leaves";

  const showApplyAction = !showPending && !showManage && (hasPermission(user, PERMISSIONS.LEAVES_REQUESTS_CREATE) || isSuperAdmin(user));

  return (
    <div>
      <PageHeader
        title={pageTitle}
        subtitle={showPending ? `${pending.length} pending your review.` : "All leave requests."}
        action={
          showApplyAction ? (
            <Btn onClick={onApplyLeave}>
              <CalendarPlus className="h-4 w-4" /> Apply Leave
            </Btn>
          ) : undefined
        }
      />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {(showPending ? pending : visibleLeaves).map((l) => (
          <Card key={l.id}>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <Avatar
                  initials={l.employee
                    .split(" ")
                    .map((x) => x[0])
                    .join("")}
                />
                <div className="min-w-0">
                  <div className="truncate font-bold">{l.employee}</div>
                  <div className="text-xs text-muted-foreground">
                    {l.type} - {l.days} day{l.days > 1 ? "s" : ""}
                  </div>
                </div>
              </div>
              <Badge
                tone={l.status === "Pending" ? "amber" : l.status === "Approved" ? "green" : "rose"}
              >
                {l.status}
              </Badge>
            </div>
            <div className="mt-3 rounded-lg bg-muted/40 p-3 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">From</span>
                <span className="font-semibold">{l.from}</span>
              </div>
              <div className="mt-1 flex justify-between">
                <span className="text-muted-foreground">To</span>
                <span className="font-semibold">{l.to}</span>
              </div>
              <div className="mt-2 text-muted-foreground">"{l.reason}"</div>
            </div>
            {l.status === "Pending" &&
              canApprove &&
              (user.role === "SuperAdmin" || l.employee !== user.name) && (
                <div className="mt-4 flex gap-2">
                  <Btn
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      try {
                        await updateLeaveStatus.mutateAsync({ id: l.id, status: "Rejected" });
                        toast("Leave request rejected.");
                      } catch (err: any) {
                        toast(err.message || "Failed to reject leave request.", "error");
                      }
                    }}
                  >
                    <X className="h-4 w-4" /> Reject
                  </Btn>
                  <Btn
                    variant="success"
                    size="sm"
                    onClick={async () => {
                      try {
                        await updateLeaveStatus.mutateAsync({ id: l.id, status: "Approved" });
                        toast("Leave request approved.");
                      } catch (err: any) {
                        toast(err.message || "Failed to approve leave request.", "error");
                      }
                    }}
                  >
                    <Check className="h-4 w-4" /> Approve
                  </Btn>
                </div>
              )}
          </Card>
        ))}
        {(showPending ? pending : visibleLeaves).length === 0 && (
          <Card className="lg:col-span-2 text-center py-12 text-sm text-muted-foreground">
            No leave requests here.
          </Card>
        )}
      </div>
      {(showPending ? pending : visibleLeaves).length > 0 && (
        <div className="mt-6">
          <PaginationControls
            currentPage={page}
            totalPages={totalPages}
            totalItems={total}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={(newSize) => {
              setPageSize(newSize);
              setPage(1);
            }}
          />
        </div>
      )}
    </div>
  );
}

function ApplyLeavePage({
  leaveTypes,
  toast,
}: {
  leaveTypes: LeaveType[];
  toast: (m: string, t?: "success" | "error" | "info") => void;
}) {
  const defaultLeaveTypes: LeaveType[] = [
    { name: "Casual Leave", days: 12, tone: "indigo" },
    { name: "Sick Leave", days: 10, tone: "rose" },
    { name: "Annual Leave", days: 15, tone: "green" },
  ];
  const effectiveLeaveTypes = leaveTypes && leaveTypes.length > 0 ? leaveTypes : defaultLeaveTypes;
  const { createLeave } = useLeaveMutations();
  const [f, setF] = useState({
    type: effectiveLeaveTypes[0]?.name || "Casual Leave",
    from: getBusinessDateString(),
    to: getBusinessDateString(),
    reason: "",
  });

  const submit = async () => {
    if (!f.reason.trim()) {
      toast("Please provide a reason for the leave.", "error");
      return;
    }
    try {
      const start = new Date(f.from);
      const end = new Date(f.to);
      const diffTime = Math.abs(end.getTime() - start.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

      await createLeave.mutateAsync({
        type: f.type,
        from: f.from,
        to: f.to,
        days: diffDays,
        reason: f.reason,
      });

      toast("Leave request submitted successfully!");
      setF({
        type: effectiveLeaveTypes[0]?.name || "Casual Leave",
        from: getBusinessDateString(),
        to: getBusinessDateString(),
        reason: "",
      });
    } catch (err: any) {
      toast(err.message || "Failed to submit leave request.", "error");
    }
  };

  return (
    <div>
      <PageHeader title="Apply Leave" subtitle="Submit a new leave application." />
      <Card className="max-w-xl">
        <div className="space-y-4">
          <Field label="Leave Type">
            <select
              value={f.type}
              onChange={(e) => setF({ ...f, type: e.target.value })}
              className={inputCls}
            >
              {effectiveLeaveTypes.map((t) => (
                <option key={t.name} value={t.name}>
                  {t.name}
                </option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="From Date">
              <input
                type="date"
                value={f.from}
                onChange={(e) => setF({ ...f, from: e.target.value })}
                className={inputCls}
              />
            </Field>
            <Field label="To Date">
              <input
                type="date"
                value={f.to}
                onChange={(e) => setF({ ...f, to: e.target.value })}
                className={inputCls}
              />
            </Field>
          </div>
          <Field label="Reason / Notes">
            <textarea
              value={f.reason}
              onChange={(e) => setF({ ...f, reason: e.target.value })}
              className={inputCls + " min-h-[100px] py-2"}
              placeholder="State reason for leave request"
            />
          </Field>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Btn onClick={submit}>Submit Request</Btn>
        </div>
      </Card>
    </div>
  );
}

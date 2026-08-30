import React, { useMemo, useEffect, useState } from "react";
import {
  Clock,
  MapPin,
  Building2,
  CalendarDays,
  Info,
  FileCheck,
} from "lucide-react";
import type { AuthUser, Employee } from "../../../types";
import { useAuthStore } from "../../../store/authStore";
import { useEmployeesQuery } from "../../../hooks/useEmployeesQuery";
import {
  useAttendanceQuery,
  useAttendanceMutations,
  useAttendanceSettingsQuery,
  useRegularizationRequestsQuery,
} from "../../../hooks/useAttendanceQuery";
import { getBusinessDateString } from "../../../utils/date.utils";
import { hasPermission, PERMISSIONS } from "../../../auth";
import { AttendanceRegularizationModal } from "../../attendance/components/AttendanceRegularizationModal";

const cardCls =
  "rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)] transition hover:shadow-[var(--shadow-elevated)]";

function Btn({
  children,
  onClick,
  variant = "primary",
  size = "md",
  className = "",
  type = "button",
  disabled,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "ghost" | "outline" | "danger" | "success";
  size?: "sm" | "md";
  className?: string;
  type?: "button" | "submit";
  disabled?: boolean;
}) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition duration-200 hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0";
  const sizes = { sm: "px-3 py-1.5 text-xs", md: "px-4 py-2 text-sm" };
  const variants = {
    primary: "btn-gradient hover:brightness-110",
    success: "bg-[color:var(--color-success)] text-white shadow-md hover:brightness-110",
    ghost: "text-muted-foreground hover:bg-muted hover:text-foreground",
    outline: "border border-border bg-card hover:border-primary hover:text-primary",
    danger: "bg-destructive text-destructive-foreground shadow-md hover:brightness-110",
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

function Badge({ children, tone = "slate" }: { children: React.ReactNode; tone?: string }) {
  const tones: Record<string, string> = {
    slate: "bg-muted text-muted-foreground",
    green: "bg-[color:var(--color-success)]/15 text-[color:var(--color-success)]",
    amber: "bg-[color:var(--color-warning)]/15 text-[color:var(--color-warning)]",
    rose: "bg-destructive/15 text-destructive",
    indigo: "bg-primary/15 text-primary",
    sky: "bg-[color:var(--color-info)]/15 text-[color:var(--color-info)]",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${tones[tone] || tones.slate}`}
    >
      {children}
    </span>
  );
}

/**
 * Deterministically resolves one authoritative today attendance record.
 * 1. Matches today's business date.
 * 2. Prefers a complete record (inTime + outTime), then inTime, then baseline.
 */
export function resolveTodayAttendance(records: any, businessDate: string) {
  const list: any[] = Array.isArray(records)
    ? records
    : records && Array.isArray(records.data)
      ? records.data
      : [];
  if (!list || list.length === 0) return null;
  const todayRecords = list.filter((rec: any) => {
    if (!rec || !rec.date) return false;
    const dStr = typeof rec.date === "string" ? rec.date.slice(0, 10) : "";
    return dStr === businessDate;
  });

  if (todayRecords.length === 0) return null;

  return (
    todayRecords.find((r: any) => Boolean(r.inTime && r.outTime)) ||
    todayRecords.find((r: any) => Boolean(r.inTime)) ||
    todayRecords[0]
  );
}

export function EmployeeClockPage({
  toast,
  user: propUser,
}: {
  toast: (m: string) => void;
  user?: AuthUser;
}) {
  const storeUser = useAuthStore((s) => s.user);
  const activeUser = propUser || storeUser || undefined;

  const { data: employeesData, employees: employeesProp } = useEmployeesQuery();
  const employees: Employee[] = Array.isArray(employeesProp) && employeesProp.length > 0
    ? employeesProp
    : (Array.isArray(employeesData)
        ? employeesData
        : (employeesData && Array.isArray((employeesData as any).data) ? (employeesData as any).data : (Array.isArray(employeesProp) ? employeesProp : [])));

  const canClock = hasPermission(activeUser, PERMISSIONS.EMPLOYEES_ATTENDANCE_CLOCK);
  const canRegularize =
    hasPermission(activeUser, PERMISSIONS.EMPLOYEES_ATTENDANCE_REGULARIZE) ||
    activeUser?.role === "SuperAdmin";

  const { data: attendanceSettings } = useAttendanceSettingsQuery();
  const enableRegularization = attendanceSettings
    ? Boolean(attendanceSettings.enableRegularization)
    : true;

  const { data: reqsRawData, requests: reqsRecordsProp } = useRegularizationRequestsQuery();
  const regularizationRequests = useMemo(() => {
    if (Array.isArray(reqsRecordsProp) && reqsRecordsProp.length > 0) {
      return reqsRecordsProp;
    }
    if (Array.isArray(reqsRawData)) {
      return reqsRawData;
    }
    if (reqsRawData && Array.isArray((reqsRawData as any).data)) {
      return (reqsRawData as any).data;
    }
    if (Array.isArray(reqsRecordsProp)) {
      return reqsRecordsProp;
    }
    return [];
  }, [reqsRawData, reqsRecordsProp]);

  const requestMap = useMemo(() => {
    const map = new Map<string, any>();
    if (regularizationRequests.length > 0) {
      regularizationRequests.forEach((r: any) => {
        if (r.attendanceId) {
          map.set(r.attendanceId, r);
        }
      });
    }
    return map;
  }, [regularizationRequests]);

  const [selectedRecordForReg, setSelectedRecordForReg] = useState<any | null>(null);

  const currentEmp = useMemo(() => {
    if (!activeUser) return null;
    if (employees && employees.length > 0) {
      const match =
        employees.find((e) => Boolean(activeUser.id && (e.userId === activeUser.id || (e as any).user?.id === activeUser.id))) ||
        employees.find((e) => Boolean(activeUser.email && e.email?.toLowerCase() === activeUser.email?.toLowerCase()));
      if (match) return match;
    }
    if ((activeUser as any).employee?.id || (activeUser as any).employeeId) {
      return {
        id: (activeUser as any).employee?.id || (activeUser as any).employeeId,
        email: activeUser.email,
        name: activeUser.name,
      };
    }
    if (activeUser.role === "Employee") {
      return {
        id: (activeUser as any).id,
        email: activeUser.email,
        name: activeUser.name,
      };
    }
    return null;
  }, [activeUser, employees]);

  const {
    data: attendanceRawData,
    records: attendanceRecordsProp,
    isLoading,
    total: attendanceTotal = 0,
    totalPages: attendanceTotalPages = 1,
    page: attendancePage = 1,
    limit: attendanceLimit = 25,
  } = useAttendanceQuery(
    currentEmp?.id ? { employeeId: currentEmp.id } : undefined,
  );

  const attendanceLogs: any[] = useMemo(() => {
    if (Array.isArray(attendanceRecordsProp) && attendanceRecordsProp.length > 0) {
      return attendanceRecordsProp;
    }
    if (Array.isArray(attendanceRawData)) {
      return attendanceRawData;
    }
    if (attendanceRawData && Array.isArray((attendanceRawData as any).data)) {
      return (attendanceRawData as any).data;
    }
    if (Array.isArray(attendanceRecordsProp)) {
      return attendanceRecordsProp;
    }
    return [];
  }, [attendanceRawData, attendanceRecordsProp]);
  const { clockInOrOut, createRegularizationRequest } = useAttendanceMutations();

  // Consistent local business date (YYYY-MM-DD)
  const todayDate = useMemo(() => getBusinessDateString(), []);

  // Single authoritative today record resolution
  const todayRecord = useMemo(
    () => resolveTodayAttendance(attendanceLogs, todayDate),
    [attendanceLogs, todayDate],
  );

  const clockedIn = Boolean(todayRecord?.inTime && !todayRecord?.outTime);
  const clockedOut = Boolean(todayRecord?.inTime && todayRecord?.outTime);

  const isSuperAdmin = activeUser?.role === "SuperAdmin";

  const getCoordinates = (): Promise<{ latitude?: number; longitude?: number; accuracy?: number } | null> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve(null);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          resolve({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          });
        },
        (err) => {
          console.warn("Geolocation position request not granted or timed out:", err.message);
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    });
  };

  const toggleClock = async () => {
    if (!canClock) {
      toast("You do not have permission to clock in or clock out.");
      return;
    }

    if (isSuperAdmin || !currentEmp) {
      toast("Attendance clock-in is only available for employee accounts.");
      return;
    }

    const time = new Date().toTimeString().slice(0, 5);
    const payload: any = {
      employeeId: currentEmp.id,
      date: todayDate,
    };

    if (clockedIn) {
      payload.outTime = time;
    } else {
      payload.inTime = time;
    }

    // Capture browser GPS telemetry if available
    const geo = await getCoordinates();
    if (geo) {
      payload.latitude = geo.latitude;
      payload.longitude = geo.longitude;
      payload.accuracy = geo.accuracy;
    }

    try {
      await clockInOrOut.mutateAsync(payload);
      if (!clockedIn) {
        toast(`Successfully clocked in at ${time}`);
      } else {
        toast(`Successfully clocked out at ${time}`);
      }
    } catch (err: any) {
      const respMsg = err?.response?.data?.message;
      const displayMsg = Array.isArray(respMsg)
        ? respMsg.join(", ")
        : respMsg || err?.message || "Attendance logging failed";
      toast(displayMsg);
    }
  };

  const handleRegularizeSubmit = async (payload: {
    attendanceId: string;
    requestedInTime: string;
    requestedOutTime: string;
    reason: string;
  }) => {
    try {
      const res = await createRegularizationRequest.mutateAsync(payload);
      if (res?.status === "APPROVED") {
        toast("Regularization request auto-approved by organization policy.");
      } else {
        toast("Regularization request submitted successfully for manager approval.");
      }
    } catch (err: any) {
      const status = err?.response?.status;
      const msg = err?.response?.data?.message;
      const displayMsg = Array.isArray(msg) ? msg.join(", ") : msg;
      if (status === 403) {
        toast(displayMsg || "Attendance regularization is disabled or unauthorized.");
      } else if (status === 409) {
        toast(displayMsg || "A regularization request is already pending for this attendance record.");
      } else if (status === 400) {
        toast(displayMsg || "Invalid requested times or reason.");
      } else if (status === 404) {
        toast(displayMsg || "Attendance record not found.");
      } else {
        toast(displayMsg || "Failed to submit regularization request.");
      }
      throw err;
    }
  };

  console.log("=== ATTENDANCE REGULARIZATION DEBUG ===", {
    activeUser,
    role: activeUser?.role,
    permissions: activeUser?.permissions,
    canRegularize,
    attendanceSettings,
    enableRegularization,
    currentEmp,
    attendanceLogsCount: attendanceLogs?.length,
    attendanceLogs,
    regularizationRequests,
    requestMapSize: requestMap.size,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Roster Clock Attendance</h1>
        <p className="text-sm text-muted-foreground">
          Clock in or out and browse recent attendance logs.
        </p>
      </div>

      {isLoading && attendanceLogs.length === 0 ? (
        <div className="flex h-[30vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div
            className={
              cardCls + " flex flex-col items-center justify-center py-10 space-y-4 md:col-span-1"
            }
          >
            <div className="grid h-20 w-20 place-items-center rounded-full bg-primary/10 text-primary">
              <Clock size={36} />
            </div>
            <div className="text-center space-y-2">
              <h3 className="text-lg font-bold">Roster Clock Status</h3>
              <p className="text-xs text-muted-foreground">
                {clockedOut
                  ? "Completed (Clocked Out)"
                  : clockedIn
                    ? "Active (Clocked In)"
                    : "Inactive (Not Clocked In)"}
              </p>
              {(isSuperAdmin || !currentEmp) && (
                <div className="p-3.5 rounded-xl border border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-400 text-xs font-medium text-left flex items-start gap-2 mt-2">
                  <Info size={16} className="shrink-0 mt-0.5" />
                  <span>Attendance clock-in is only available for employee accounts.</span>
                </div>
              )}
              {!canClock && !isSuperAdmin && currentEmp && (
                <div className="p-3.5 rounded-xl border border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-400 text-xs font-medium text-left flex items-start gap-2 mt-2">
                  <Info size={16} className="shrink-0 mt-0.5" />
                  <span>You do not have permission to clock in or clock out.</span>
                </div>
              )}
            </div>

            <div className="text-xs text-muted-foreground flex gap-4">
              <span>In: {todayRecord?.inTime || todayRecord?.checkIn || "–"}</span>
              <span>Out: {todayRecord?.outTime || todayRecord?.checkOut || "–"}</span>
            </div>

            <Btn
              className="w-full justify-center py-3"
              onClick={toggleClock}
              variant={clockedIn ? "danger" : "primary"}
              disabled={isSuperAdmin || !currentEmp || clockedOut || !canClock || clockInOrOut.isPending}
            >
              {clockInOrOut.isPending
                ? "Processing..."
                : clockedOut
                  ? "Completed for Today"
                  : clockedIn
                    ? "Clock Out"
                    : "Clock In"}
            </Btn>
          </div>

          <div className={cardCls + " md:col-span-2 space-y-4"}>
            <h3 className="font-bold">Recent Clock-in Logs</h3>
            <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
              {attendanceLogs.map((h: any, i: number) => {
                const existingReq = h.id ? requestMap.get(h.id) : null;
                const isTodayActive = h.date === todayDate && clockedIn;

                return (
                  <div
                    key={h.id || i}
                    className="flex justify-between items-center p-3 bg-muted/40 rounded-xl border border-border text-sm gap-3"
                  >
                    <div className="space-y-0.5">
                      <div className="font-bold flex items-center gap-2">
                        <span>{h.date}</span>
                        {existingReq && (
                          <span className="text-[10px] text-muted-foreground font-normal">
                            (Req: {existingReq.requestedInTime} - {existingReq.requestedOutTime})
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        In: {h.inTime || h.checkIn || "–"} | Out: {h.outTime || h.checkOut || "–"}
                      </div>
                      {existingReq && existingReq.status === "REJECTED" && existingReq.reviewerRemark && (
                        <div className="text-[11px] text-rose-500 font-medium pt-0.5">
                          Rejection Remark: "{existingReq.reviewerRemark}"
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Badge
                        tone={
                          h.status === "Present"
                            ? "green"
                            : h.status === "Late"
                              ? "amber"
                              : "rose"
                        }
                      >
                        {h.status}
                      </Badge>

                      {existingReq ? (
                        <Badge
                          tone={
                            existingReq.status === "APPROVED"
                              ? "green"
                              : existingReq.status === "PENDING"
                                ? "amber"
                                : "rose"
                          }
                        >
                          {existingReq.status === "APPROVED"
                            ? "Approved"
                            : existingReq.status === "PENDING"
                              ? "Pending Approval"
                              : "Rejected"}
                        </Badge>
                      ) : (
                        canRegularize &&
                        enableRegularization &&
                        !isTodayActive && (
                          <Btn
                            size="sm"
                            variant="outline"
                            onClick={() => setSelectedRecordForReg(h)}
                          >
                            Request Regularization
                          </Btn>
                        )
                      )}
                    </div>
                  </div>
                );
              })}
              {attendanceLogs.length === 0 && (
                <div className="text-center py-10 text-xs text-muted-foreground">
                  No attendance logs found.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Attendance Regularization Modal */}
      <AttendanceRegularizationModal
        isOpen={Boolean(selectedRecordForReg)}
        onClose={() => setSelectedRecordForReg(null)}
        record={selectedRecordForReg}
        onSubmit={handleRegularizeSubmit}
        isSubmitting={createRegularizationRequest.isPending}
      />
    </div>
  );
}


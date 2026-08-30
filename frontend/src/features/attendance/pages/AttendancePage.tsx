import { useState, useMemo } from "react";
import { getBusinessDateString, getRollingBusinessMonths, parseMonthString } from "../../../utils/date.utils";
import { hasPermission, isSuperAdmin, PERMISSIONS } from "../../../auth";
import {
  Plus,
  CalendarCheck,
  CalendarDays,
  Check,
  X,
  Trash2,
  Clock,
  Activity,
  Fingerprint,
  MapPin,
  RefreshCw,
  ShieldCheck,
  ToggleLeft,
  ToggleRight,
  Edit,
  AlertTriangle,
  ArrowRight,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
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
import { calcAttendanceStats } from "../../../domain/attendance/calcAttendanceStats";
import type { Employee, Device, Zone, BadgeTone } from "../../../types";
import { useEmployeesQuery } from "../../../hooks/useEmployeesQuery";
import {
  useAttendanceQuery,
  useAttendanceMutations,
  useAttendanceMatrixQuery,
} from "../../../hooks/useAttendanceQuery";
import {
  useDepartmentsQuery,
  useDevicesQuery,
  useZonesQuery,
  useOrgMutations,
} from "../../../hooks/useOrgQuery";
import { attendanceService } from "../../../services/attendance.service";
import { employeeService } from "../../../services/employee.service";
import { useEffect } from "react";
import { useOrgStore } from "../../../store";
import { GeoZoneMapPicker } from "../components/GeoZoneMapPicker";
import { SearchablePaginatedSelect } from "../../../components/ui/SearchablePaginatedSelect";
import { PaginationControls } from "../../../components/ui/PaginationControls";

function ManualAttendancePage({
  employees = [],
  canEdit,
  toast,
  attendanceRecords = [],
  clockInOut,
}: {
  employees?: Employee[];
  canEdit: boolean;
  toast: (m: string, tone?: "success" | "error" | "info") => void;
  attendanceRecords?: any[];
  clockInOut: (record: any) => Promise<any>;
}) {
  const [f, setF] = useState({
    employeeId: employees[0]?.id || "",
    date: getBusinessDateString(),
    inTime: "09:00",
    outTime: "18:00",
    status: "Present",
    remarks: "",
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!f.employeeId && employees.length > 0) {
      setF((prev) => ({ ...prev, employeeId: employees[0].id }));
    }
  }, [employees, f.employeeId]);

  const save = async () => {
    if (!f.employeeId) {
      toast("Please select an employee", "error");
      return;
    }

    if (f.date > getBusinessDateString()) {
      toast("Attendance entry for future dates is not allowed", "error");
      return;
    }

    const [inH, inM] = f.inTime.split(":").map(Number);
    const [outH, outM] = f.outTime.split(":").map(Number);
    if (outH < inH || (outH === inH && outM <= inM)) {
      toast("Check-out time must be later than Check-in time", "error");
      return;
    }

    if (f.remarks && f.remarks.length > 250) {
      toast("Remarks must not exceed 250 characters", "error");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        employeeId: f.employeeId,
        date: f.date,
        inTime: f.inTime,
        outTime: f.outTime,
        status: f.status,
        remarks: f.remarks || "Manual Entry",
      };
      await clockInOut(payload);
      const emp = employees.find((e) => e.id === f.employeeId);
      toast(emp ? `Attendance saved for ${emp.name} on ${f.date}` : `Attendance saved on ${f.date}`, "success");
    } catch (err: any) {
      const respMsg = err?.response?.data?.message;
      const displayMsg = Array.isArray(respMsg)
        ? respMsg.join(", ")
        : (respMsg || err?.message || "Failed to save attendance record");
      toast(displayMsg, "error");
    } finally {
      setLoading(false);
    }
  };
  const todayRecords = attendanceRecords
    .filter((r: any) => r.date === f.date)
    .sort((a: any, b: any) => (a.employeeName || "").localeCompare(b.employeeName || ""));
  return (
    <div>
      {!canEdit && <ReadOnlyBanner />}
      <PageHeader
        title="Manual Attendance"
        subtitle="Mark or update attendance for employees. Changes are saved to the shared attendance record."
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <div className="mb-4 text-sm font-bold flex items-center gap-2">
            <CalendarCheck className="h-4 w-4 text-primary" /> Mark Attendance
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="Employee">
              <SearchablePaginatedSelect
                value={f.employeeId}
                initialSelectedOption={
                  employees[0]
                    ? {
                        value: employees[0].id,
                        label: employees[0].name,
                      }
                    : undefined
                }
                onChange={(val) => setF({ ...f, employeeId: val })}
                queryFn={async (search, page, limit) => {
                  const res = await employeeService.getEmployees({
                    search: search || undefined,
                    page,
                    limit,
                  });
                  return {
                    data: (res.data || []).map((e: any) => ({
                      value: e.id,
                      label: e.name || e.fullName || "Unnamed",
                      sublabel: e.email || e.department,
                    })),
                    total: res.total,
                    totalPages: res.totalPages,
                    page: res.page,
                    limit: res.limit,
                  };
                }}
                placeholder="Search and select employee..."
              />
            </Field>
            <Field label="Date">
              <input
                {...dateInputProps(f.date, (v) => setF({ ...f, date: v }))}
                className={inputCls}
              />
            </Field>
            <Field label="Check-in Time">
              <input
                type="time"
                value={f.inTime}
                onChange={(e) => setF({ ...f, inTime: e.target.value })}
                className={inputCls}
              />
            </Field>
            <Field label="Check-out Time">
              <input
                type="time"
                value={f.outTime}
                onChange={(e) => setF({ ...f, outTime: e.target.value })}
                className={inputCls}
              />
            </Field>
            <Field label="Status">
              <select
                value={f.status}
                onChange={(e) => setF({ ...f, status: e.target.value })}
                className={inputCls}
              >
                <option>Present</option>
                <option>Half Day</option>
                <option>Absent</option>
                <option>Late</option>
              </select>
            </Field>
            <Field label="Remarks (Optional)">
              <input
                value={f.remarks}
                onChange={(e) => setF({ ...f, remarks: e.target.value })}
                className={inputCls}
                placeholder="e.g. Power outage"
              />
            </Field>
          </div>
          <div className="mt-6 flex justify-end gap-2">
            {canEdit && (
              <Btn onClick={save} disabled={loading}>
                {loading ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                <span>{loading ? "Saving..." : "Save Entry"}</span>
              </Btn>
            )}
          </div>
        </Card>
        <Card className="!p-0 overflow-hidden">
          <div className="border-b border-border p-4 text-sm font-bold flex items-center justify-between">
            <span>Records for {f.date}</span>
            <Badge tone="indigo">{todayRecords.length} entries</Badge>
          </div>
          <div className="divide-y divide-border/60 max-h-[360px] overflow-y-auto">
            {todayRecords.length === 0 && (
              <div className="p-8 text-center text-sm text-muted-foreground">
                No records for this date.
              </div>
            )}
            {todayRecords.map((r: any) => (
              <div
                key={r.id}
                className="flex items-center justify-between px-4 py-3 hover:bg-muted/30"
              >
                <div>
                  <div className="text-sm font-semibold">{r.employeeName}</div>
                  <div className="text-xs text-muted-foreground">
                    {r.checkIn} → {r.checkOut} · {r.verificationType}
                  </div>
                </div>
                <Badge
                  tone={
                    r.status === "Present"
                      ? "green"
                      : r.status === "Absent"
                        ? "rose"
                        : r.status === "On Leave"
                          ? "amber"
                          : "indigo"
                  }
                >
                  {r.status}
                </Badge>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

function BiometricPage({
  devices,
  canEdit,
  toast,
  triggerConfirm,
}: {
  devices: Device[];
  canEdit: boolean;
  toast: (m: string, tone?: "success" | "error" | "info") => void;
  triggerConfirm: (msg: string, fn: () => void, title?: string) => void;
}) {
  const { createDevice, deleteDevice, syncDevice } = useOrgMutations();
  const [open, setOpen] = useState(false);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [f, setF] = useState({
    name: "",
    ip: "",
    port: "4370",
    manufacturer: "ZKTeco",
    model: "",
    serial: "",
    commMode: "TCP/IP",
    sdkType: "ZKLib",
    location: "",
    adminPin: "",
    enrolledUsers: "0",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const add = async () => {
    const errs: Record<string, string> = {};
    const nameClean = f.name.trim();
    if (!nameClean) errs.name = "Required";
    else if (nameClean.length > 250) errs.name = "Name must not exceed 250 characters";
    else if (/[<>'"&;]|(OR\s+1=1)/i.test(nameClean)) errs.name = "Invalid characters detected";

    const ipClean = f.ip.trim();
    if (!ipClean) errs.ip = "Required";
    else if (
      !/^(25[0-5]|2[0-4]\d|[0-1]?\d?\d)(\.(25[0-5]|2[0-4]\d|[0-1]?\d?\d)){3}$/.test(ipClean)
    ) {
      errs.ip = "Invalid IPv4 address format";
    }

    const portNum = Number(f.port);
    if (!f.port.trim()) errs.port = "Required";
    else if (isNaN(portNum) || portNum < 1 || portNum > 65535 || !/^\d+$/.test(f.port)) {
      errs.port = "Port must be 1 to 65535";
    }

    if (f.model.trim().length > 250) errs.model = "Model Number must not exceed 250 characters";
    else if (/[<>'"&;]/i.test(f.model)) errs.model = "Invalid characters in Model Number";

    if (f.serial.trim().length > 250) errs.serial = "Serial Number must not exceed 250 characters";
    else if (/[<>'"&;]/i.test(f.serial)) errs.serial = "Invalid characters in Serial Number";

    if (f.location.trim().length > 250)
      errs.location = "Location/Branch must not exceed 250 characters";
    else if (/[<>'"&;]/i.test(f.location)) errs.location = "Invalid characters in Location/Branch";

    if (f.adminPin.trim()) {
      if (!/^\d+$/.test(f.adminPin) || f.adminPin.length > 8) {
        errs.adminPin = "Admin PIN must be numeric up to 8 digits";
      }
    }

    if (!f.enrolledUsers.trim()) errs.enrolledUsers = "Required";
    else if (!/^\d+$/.test(f.enrolledUsers)) {
      errs.enrolledUsers = "Enrolled Users must be a positive integer";
    }

    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    try {
      await createDevice.mutateAsync({ name: nameClean, ip: `${ipClean}:${f.port}` });
      toast(`Device "${nameClean}" added and synced`, "success");
      setOpen(false);
      setF({
        name: "",
        ip: "",
        port: "4370",
        manufacturer: "ZKTeco",
        model: "",
        serial: "",
        commMode: "TCP/IP",
        sdkType: "ZKLib",
        location: "",
        adminPin: "",
        enrolledUsers: "0",
      });
      setErrors({});
    } catch (err: any) {
      toast(err?.message || "Failed to add device", "error");
    }
  };

  const resync = async (id: string, name: string) => {
    setSyncing(id);
    try {
      await syncDevice.mutateAsync(id);
      toast(`Device "${name}" re-synced successfully`, "success");
    } catch (err: any) {
      toast(err?.message || "Failed to sync device", "error");
    } finally {
      setSyncing(null);
    }
  };

  const refresh = async (id: string) => {
    try {
      await syncDevice.mutateAsync(id);
      toast("Device status refreshed", "success");
    } catch (err: any) {
      toast(err?.message || "Failed to refresh device", "error");
    }
  };

  const handleDeleteDevice = (id: string, name: string) => {
    triggerConfirm(
      `Remove device "${name}" from the system?`,
      async () => {
        try {
          await deleteDevice.mutateAsync(id);
          toast(`Device "${name}" removed`, "success");
        } catch (err: any) {
          toast(err?.message || "Failed to delete device", "error");
        }
      },
      "Remove Device",
    );
  };
  return (
    <div>
      {!canEdit && <ReadOnlyBanner />}
      <PageHeader
        title="Biometric Integration"
        subtitle="Connected attendance devices and sync status."
        action={
          canEdit && (
            <Btn onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4" /> Add Device
            </Btn>
          )
        }
      />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {devices.map((d) => (
          <Card key={d.id} className="overflow-hidden">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="grid h-11 w-11 place-items-center rounded-xl btn-gradient shrink-0">
                  <Fingerprint className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <div className="font-bold truncate max-w-[240px]" title={d.name}>
                    {d.name}
                  </div>
                  <div className="text-xs text-muted-foreground break-all">
                    {d.ip} · ID: {d.id}
                  </div>
                </div>
              </div>
              <Badge tone={d.status === "Online" ? "green" : "rose"} className="shrink-0">
                {d.status}
              </Badge>
            </div>
            <div className="mt-3 flex justify-between text-xs text-muted-foreground">
              <span>Last heartbeat</span>
              <span className="font-semibold">{d.last}</span>
            </div>
            {canEdit && (
              <div className="mt-4 flex gap-2 flex-wrap">
                <Btn
                  variant="outline"
                  size="sm"
                  onClick={() => resync(d.id, d.name)}
                  disabled={syncing === d.id}
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${syncing === d.id ? "animate-spin" : ""}`} />
                  {syncing === d.id ? "Syncing…" : "Re-sync"}
                </Btn>
                <Btn variant="outline" size="sm" onClick={() => refresh(d.id)}>
                  <Activity className="h-3.5 w-3.5" /> Refresh
                </Btn>
                <Btn
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDeleteDevice(d.id, d.name)}
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </Btn>
              </div>
            )}
          </Card>
        ))}
        {devices.length === 0 && (
          <Card className="lg:col-span-2 text-center py-12 text-sm text-muted-foreground">
            No devices configured.
          </Card>
        )}
      </div>
      {open && (
        <ModalShell title="Add Biometric Device" onClose={() => setOpen(false)} wide>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="Device Name *" error={errors.name}>
              <input
                value={f.name}
                onChange={(e) => setF({ ...f, name: e.target.value })}
                className={inputCls}
                placeholder="e.g. HQ Main Gate"
              />
            </Field>
            <Field label="IP Address *" error={errors.ip}>
              <input
                value={f.ip}
                onChange={(e) => setF({ ...f, ip: e.target.value })}
                className={inputCls}
                placeholder="192.168.1.15"
              />
            </Field>
            <Field label="Port" error={errors.port}>
              <input
                value={f.port}
                onChange={(e) => setF({ ...f, port: e.target.value })}
                className={inputCls}
                placeholder="4370"
              />
            </Field>
            <Field label="Manufacturer">
              <select
                value={f.manufacturer}
                onChange={(e) => setF({ ...f, manufacturer: e.target.value })}
                className={inputCls}
              >
                {["ZKTeco", "Mantra", "Suprema", "eSSL", "Evolvent", "Hikvision", "Anviz"].map(
                  (m) => (
                    <option key={m}>{m}</option>
                  ),
                )}
              </select>
            </Field>
            <Field label="Model Number" error={errors.model}>
              <input
                value={f.model}
                onChange={(e) => setF({ ...f, model: e.target.value })}
                className={inputCls}
                placeholder="e.g. ZK-K30"
              />
            </Field>
            <Field label="Serial Number" error={errors.serial}>
              <input
                value={f.serial}
                onChange={(e) => setF({ ...f, serial: e.target.value })}
                className={inputCls}
                placeholder="e.g. ZK1234567890"
              />
            </Field>
            <Field label="Communication Mode">
              <select
                value={f.commMode}
                onChange={(e) => setF({ ...f, commMode: e.target.value })}
                className={inputCls}
              >
                {["TCP/IP", "USB", "RS232", "RS485", "WiFi"].map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
            </Field>
            <Field label="SDK Type">
              <select
                value={f.sdkType}
                onChange={(e) => setF({ ...f, sdkType: e.target.value })}
                className={inputCls}
              >
                {["ZKLib", "ADMS Push", "Biometric SDK", "OSDP"].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </Field>
            <Field label="Location / Branch" error={errors.location}>
              <input
                value={f.location}
                onChange={(e) => setF({ ...f, location: e.target.value })}
                className={inputCls}
                placeholder="e.g. Bangalore HQ"
              />
            </Field>
            <Field label="Admin PIN" error={errors.adminPin}>
              <input
                type="password"
                value={f.adminPin}
                onChange={(e) => setF({ ...f, adminPin: e.target.value })}
                className={inputCls}
                placeholder="Device admin PIN"
              />
            </Field>
            <Field label="Enrolled Users (current count)" error={errors.enrolledUsers}>
              <input
                type="number"
                value={f.enrolledUsers}
                onChange={(e) => setF({ ...f, enrolledUsers: e.target.value })}
                className={inputCls}
              />
            </Field>
          </div>
          <div className="mt-2 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
            Ensure the device is on the same network and the communication port is not firewalled.
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <Btn variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Btn>
            <Btn onClick={add}>Add &amp; Sync Device</Btn>
          </div>
        </ModalShell>
      )}
    </div>
  );
}

function GeoPage({
  zones,
  canEdit,
  toast,
  triggerConfirm,
}: {
  zones: any[];
  canEdit: boolean;
  toast: (m: string, tone?: "success" | "error" | "info") => void;
  triggerConfirm: (msg: string, fn: () => void, title?: string) => void;
}) {
  const { createZone, updateZone, deleteZone } = useOrgMutations();
  const [open, setOpen] = useState(false);
  const [editingZone, setEditingZone] = useState<any | null>(null);
  const [f, setF] = useState({
    name: "",
    lat: "",
    lng: "",
    radius: 150,
    address: "",
    enabled: true,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const openAdd = () => {
    setEditingZone(null);
    setF({
      name: "",
      lat: "",
      lng: "",
      radius: 150,
      address: "",
      enabled: true,
    });
    setErrors({});
    setOpen(true);
  };

  const openEdit = (zone: any) => {
    setEditingZone(zone);
    setF({
      name: zone.name || "",
      lat: zone.latitude !== null && zone.latitude !== undefined ? String(zone.latitude) : "",
      lng: zone.longitude !== null && zone.longitude !== undefined ? String(zone.longitude) : "",
      radius: zone.radiusMeters || (typeof zone.radius === "number" ? zone.radius : parseInt(String(zone.radius || 150), 10)) || 150,
      address: zone.address || "",
      enabled: zone.enabled !== undefined ? zone.enabled : true,
    });
    setErrors({});
    setOpen(true);
  };

  const save = async () => {
    const errs: Record<string, string> = {};

    const nameClean = f.name.trim();
    if (!nameClean) errs.name = "Zone name is required";
    else if (nameClean.length > 250) errs.name = "Zone name must not exceed 250 characters";

    const latNum = Number(f.lat);
    if (!f.lat.trim()) {
      errs.lat = "Latitude is required";
    } else if (isNaN(latNum) || latNum < -90 || latNum > 90) {
      errs.lat = "Latitude must be a decimal between -90 and 90";
    }

    const lngNum = Number(f.lng);
    if (!f.lng.trim()) {
      errs.lng = "Longitude is required";
    } else if (isNaN(lngNum) || lngNum < -180 || lngNum > 180) {
      errs.lng = "Longitude must be a decimal between -180 and 180";
    }

    const radiusNum = Number(f.radius);
    if (isNaN(radiusNum) || radiusNum <= 0 || radiusNum > 10000) {
      errs.radius = "Radius must be a positive integer up to 10,000 meters";
    }

    if (f.address.trim().length > 500) {
      errs.address = "Address must not exceed 500 characters";
    }

    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    try {
      if (editingZone) {
        await updateZone.mutateAsync({
          id: editingZone.id,
          data: {
            name: nameClean,
            latitude: latNum,
            longitude: lngNum,
            radiusMeters: radiusNum,
            address: f.address.trim() || undefined,
            enabled: f.enabled,
          },
        });
        toast(`Zone "${nameClean}" updated successfully`, "success");
      } else {
        await createZone.mutateAsync({
          name: nameClean,
          latitude: latNum,
          longitude: lngNum,
          radiusMeters: radiusNum,
          address: f.address.trim() || undefined,
          enabled: f.enabled,
        });
        toast(`Zone "${nameClean}" created successfully`, "success");
      }
      setOpen(false);
      setEditingZone(null);
    } catch (err: any) {
      toast(err?.response?.data?.message || err?.message || "Failed to save zone", "error");
    }
  };

  const handleDeleteZone = (zone: any) => {
    triggerConfirm(
      `Delete geo-fencing zone "${zone.name}"? This cannot be undone.`,
      async () => {
        try {
          await deleteZone.mutateAsync(zone.id);
          toast(`Zone "${zone.name}" removed`, "success");
        } catch (err: any) {
          toast(err?.response?.data?.message || err?.message || "Failed to remove zone", "error");
        }
      },
      "Delete Zone",
    );
  };

  return (
    <div>
      {!canEdit && <ReadOnlyBanner />}
      <PageHeader
        title="Geo-Fencing"
        subtitle="Location-based attendance zones with authoritative boundary enforcement."
        action={
          canEdit && (
            <Btn onClick={openAdd}>
              <Plus className="h-4 w-4" /> Add Zone
            </Btn>
          )
        }
      />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {zones.map((z: any) => {
          const isComplete =
            z.latitude !== null &&
            z.latitude !== undefined &&
            z.longitude !== null &&
            z.longitude !== undefined;
          const isActive = z.enabled && isComplete;

          return (
            <Card key={z.id || z.name} className="overflow-hidden relative flex flex-col justify-between">
              <div>
                <div className="mb-3 grid h-24 place-items-center rounded-xl bg-gradient-to-br from-[color:var(--color-success)]/10 to-[color:var(--color-info)]/10 relative">
                  <MapPin className="h-8 w-8 text-[color:var(--color-success)]" />
                  {canEdit && (
                    <div className="absolute top-2 right-2 flex gap-1">
                      <button
                        onClick={() => openEdit(z)}
                        title="Edit zone"
                        className="grid h-7 w-7 place-items-center rounded-lg bg-background/80 text-muted-foreground transition hover:text-foreground hover:bg-background"
                      >
                        <Edit className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteZone(z)}
                        title="Delete zone"
                        className="grid h-7 w-7 place-items-center rounded-lg bg-background/80 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>
                <div className="font-bold truncate max-w-[240px] text-foreground" title={z.name}>
                  {z.name}
                </div>
                <div className="mt-1 text-xs text-muted-foreground break-all">
                  {isComplete
                    ? `${Number(z.latitude).toFixed(4)}°, ${Number(z.longitude).toFixed(4)}° · Radius ${z.radiusMeters || z.radius}m`
                    : `Incomplete Coordinates · Radius ${z.radiusMeters || z.radius}m`}
                </div>
                {z.address && (
                  <div className="mt-1 text-xs text-muted-foreground/80 truncate" title={z.address}>
                    📍 {z.address}
                  </div>
                )}
              </div>
              <div className="mt-4 pt-3 border-t border-border/50 flex items-center justify-between text-xs">
                <span className="text-muted-foreground">
                  {isComplete ? "Configured" : "Needs Longitude"}
                </span>
                {isActive ? (
                  <Badge tone="green">Active</Badge>
                ) : (
                  <Badge tone="amber">Requires Review</Badge>
                )}
              </div>
            </Card>
          );
        })}
        {zones.length === 0 && (
          <Card className="lg:col-span-3 text-center py-12 text-sm text-muted-foreground">
            No geo-fencing zones configured.
          </Card>
        )}
      </div>

      {open && (
        <ModalShell
          title={editingZone ? `Edit Zone: ${editingZone.name}` : "Configure Geo-Fencing Zone"}
          onClose={() => setOpen(false)}
          wide
        >
          <div className="space-y-4">
            <GeoZoneMapPicker
              latitude={f.lat}
              longitude={f.lng}
              radiusMeters={f.radius}
              address={f.address}
              onLocationChange={(newLat, newLng, newAddress) => {
                setF((prev) => ({
                  ...prev,
                  lat: String(newLat),
                  lng: String(newLng),
                  ...(newAddress ? { address: newAddress } : {}),
                }));
                setErrors((prev) => {
                  const updated = { ...prev };
                  delete updated.lat;
                  delete updated.lng;
                  return updated;
                });
              }}
            />

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 pt-2 border-t border-border/50">
              <Field className="md:col-span-2" label="Zone Name *" error={errors.name}>
                <input
                  value={f.name}
                  onChange={(e) => setF({ ...f, name: e.target.value })}
                  className={inputCls}
                  placeholder="e.g. Pune Head Office"
                />
              </Field>
              <Field label="Latitude (decimal degrees) *" error={errors.lat}>
                <input
                  value={f.lat}
                  onChange={(e) => setF({ ...f, lat: e.target.value })}
                  className={inputCls}
                  placeholder="18.5204"
                />
              </Field>
              <Field label="Longitude (decimal degrees) *" error={errors.lng}>
                <input
                  value={f.lng}
                  onChange={(e) => setF({ ...f, lng: e.target.value })}
                  className={inputCls}
                  placeholder="73.8567"
                />
              </Field>
              <Field label="Radius in Metres *" error={errors.radius}>
                <input
                  type="number"
                  value={f.radius}
                  onChange={(e) => setF({ ...f, radius: Number(e.target.value) })}
                  className={inputCls}
                  placeholder="150"
                />
              </Field>
              <Field label="Address / Landmark" error={errors.address}>
                <input
                  value={f.address}
                  onChange={(e) => setF({ ...f, address: e.target.value })}
                  className={inputCls}
                  placeholder="e.g. MG Road, Pune, Maharashtra"
                />
              </Field>
              <Field className="md:col-span-2" label="Zone Status">
                <label className="flex items-center gap-2 text-sm cursor-pointer mt-1">
                  <input
                    type="checkbox"
                    checked={f.enabled}
                    onChange={(e) => setF({ ...f, enabled: e.target.checked })}
                    className="rounded border-border"
                  />
                  <span className="text-foreground">Enable this zone for attendance verification</span>
                </label>
              </Field>
            </div>
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <Btn variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Btn>
            <Btn onClick={save}>
              {editingZone ? "Save Changes" : "Create Zone"}
            </Btn>
          </div>
        </ModalShell>
      )}
    </div>
  );
}

function HistoryPage({
  employees,
  isSelf,
  userName,
  attendanceRecords: _initialAttendanceRecords,
}: {
  employees: Employee[];
  isSelf?: boolean;
  userName?: string;
  attendanceRecords?: any[];
}) {
  const [filterEmp, setFilterEmp] = useState("All");
  const [filterStatus, setFilterStatus] = useState("All");
  const [filterDate, setFilterDate] = useState("");
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);

  const selectedEmpId = filterEmp !== "All" ? employees.find((e) => e.name === filterEmp)?.id : undefined;

  const {
    records = [],
    total = 0,
    totalPages = 0,
    isLoading,
  } = useAttendanceQuery({
    employeeId: selectedEmpId,
    status: filterStatus !== "All" ? filterStatus : undefined,
    date: filterDate || undefined,
    page,
    limit: pageSize,
  });

  useEffect(() => {
    if (page > totalPages && totalPages > 0) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const calcHours = (inT: string, outT: string) => {
    if (!inT || !outT || inT === "–" || outT === "–") return "–";
    const [ih, im] = inT.split(":").map(Number);
    const [oh, om] = outT.split(":").map(Number);
    const diff = oh * 60 + om - (ih * 60 + im);
    if (diff <= 0) return "–";
    return `${Math.floor(diff / 60)}h ${diff % 60}m`;
  };

  return (
    <div>
      <PageHeader
        title={isSelf ? "My Attendance History" : "Attendance History"}
        subtitle={isLoading ? "Loading records..." : `${total} records found.`}
      />
      <Card className="mb-4">
        <div className="flex flex-wrap gap-3">
          {!isSelf && (
            <div className="flex-1 min-w-[160px]">
              <select
                value={filterEmp}
                onChange={(e) => {
                  setFilterEmp(e.target.value);
                  setPage(1);
                }}
                className={inputCls}
              >
                <option value="All">All Employees</option>
                {employees.map((e) => (
                  <option key={e.id}>{e.name}</option>
                ))}
              </select>
            </div>
          )}
          <div className="flex-1 min-w-[160px]">
            <select
              value={filterStatus}
              onChange={(e) => {
                setFilterStatus(e.target.value);
                setPage(1);
              }}
              className={inputCls}
            >
              <option value="All">All Statuses</option>
              <option>Present</option>
              <option>Absent</option>
              <option>Late</option>
              <option>Half Day</option>
              <option>On Leave</option>
            </select>
          </div>
          <div className="flex-1 min-w-[160px]">
            <input
              type="date"
              value={filterDate}
              onChange={(e) => {
                setFilterDate(e.target.value);
                setPage(1);
              }}
              className={inputCls}
              placeholder="Filter by date"
            />
          </div>
          {(filterEmp !== "All" || filterStatus !== "All" || filterDate) && (
            <button
              onClick={() => {
                setFilterEmp("All");
                setFilterStatus("All");
                setFilterDate("");
                setPage(1);
              }}
              className="text-xs font-semibold text-primary hover:underline"
            >
              Reset Filters
            </button>
          )}
        </div>
      </Card>
      <Card className="!p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left text-xs uppercase text-muted-foreground">
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Employee</th>
                <th className="px-4 py-3">In</th>
                <th className="px-4 py-3">Out</th>
                <th className="px-4 py-3">Hours</th>
                <th className="px-4 py-3">Source</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r: any) => (
                <tr key={r.id} className="border-b border-border/60 hover:bg-muted/30">
                  <td className="px-4 py-3 text-muted-foreground">{r.date}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-2">
                      <Avatar
                        initials={(r.employeeName || "Employee")
                          .split(" ")
                          .map((x: string) => x[0])
                          .join("")
                          .toUpperCase()
                          .slice(0, 2)}
                        size={26}
                      />
                      {r.employeeName || "Unknown"}
                    </span>
                  </td>
                  <td className="px-4 py-3">{r.checkIn || r.inTime || "–"}</td>
                  <td className="px-4 py-3">{r.checkOut || r.outTime || "–"}</td>
                  <td className="px-4 py-3 font-semibold">{calcHours(r.checkIn || r.inTime, r.checkOut || r.outTime)}</td>
                  <td className="px-4 py-3">
                    <Badge tone="sky">{r.verificationType || r.source || "Manual"}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      tone={
                        r.status === "Present"
                          ? "green"
                          : r.status === "Absent"
                            ? "rose"
                            : r.status === "On Leave"
                              ? "amber"
                              : r.status === "Late"
                                ? "indigo"
                                : "slate"
                      }
                    >
                      {r.status}
                    </Badge>
                  </td>
                </tr>
              ))}
              {records.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-sm text-muted-foreground">
                    {isLoading ? "Loading attendance records..." : "No attendance records found."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
      {records.length > 0 && (
        <div className="mt-4">
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

function AttendanceSettingsPage({
  toast,
  canEdit = true,
  zones = [],
}: {
  toast: (m: string, tone?: "success" | "error" | "info") => void;
  canEdit?: boolean;
  zones?: any[];
}) {
  let queryClient: any = null;
  try {
    queryClient = useQueryClient();
  } catch {}

  const [f, setF] = useState({
    gracePeriod: 15,
    halfDayThreshold: 240,
    otMultiplier: 1.5,
    enableRegularization: true,
    selfRegularization: false,
    enableGeofencing: false,
    geofenceOnClockOut: false,
    shiftName: "General",
    shiftStart: "09:00",
    shiftEnd: "18:00",
    weekOffs: ["Saturday", "Sunday"],
  });
  const [loading, setLoading] = useState(false);
  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const toggleDay = (d: string) => {
    if (!canEdit) return;
    setF((prev) => ({
      ...prev,
      weekOffs: prev.weekOffs.includes(d)
        ? prev.weekOffs.filter((x) => x !== d)
        : [...prev.weekOffs, d],
    }));
  };

  const activeZonesCount = useMemo(() => {
    return zones.filter(
      (z: any) =>
        z.enabled &&
        z.latitude !== null &&
        z.latitude !== undefined &&
        z.longitude !== null &&
        z.longitude !== undefined,
    ).length;
  }, [zones]);

  useEffect(() => {
    async function loadSettings() {
      try {
        const res = await attendanceService.getSettings();
        if (res) {
          setF({
            gracePeriod: Number(res.gracePeriod) || 15,
            halfDayThreshold: Number(res.halfDayThreshold) || 240,
            otMultiplier: Number(res.otMultiplier) || 1.5,
            enableRegularization: Boolean(res.enableRegularization),
            selfRegularization: Boolean(res.selfRegularization),
            enableGeofencing: Boolean(res.enableGeofencing),
            geofenceOnClockOut: Boolean(res.geofenceOnClockOut),
            shiftName: res.shiftName || "General",
            shiftStart: res.shiftStart || "09:00",
            shiftEnd: res.shiftEnd || "18:00",
            weekOffs: res.weekOffs
              ? res.weekOffs
                  .split(",")
                  .map((s: string) => s.trim())
                  .filter(Boolean)
              : ["Saturday", "Sunday"],
          });
        }
      } catch (err) {
        console.error("Failed to load settings:", err);
      }
    }
    loadSettings();
  }, []);

  const save = async () => {
    if (!canEdit) {
      toast("You do not have permission to modify attendance settings", "error");
      return;
    }
    try {
      setLoading(true);
      await attendanceService.updateSettings({
        gracePeriod: f.gracePeriod,
        halfDayThreshold: f.halfDayThreshold,
        otMultiplier: f.otMultiplier,
        enableRegularization: f.enableRegularization,
        selfRegularization: f.selfRegularization,
        enableGeofencing: f.enableGeofencing,
        geofenceOnClockOut: f.geofenceOnClockOut,
        shiftName: f.shiftName,
        shiftStart: f.shiftStart,
        shiftEnd: f.shiftEnd,
        weekOffs: f.weekOffs.join(","),
      });
      if (queryClient) {
        queryClient.invalidateQueries({ queryKey: ["attendance", "settings"] });
      }
      toast("Attendance settings saved successfully!");
    } catch (err: any) {
      toast(err?.message || "Failed to save settings", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {!canEdit && <ReadOnlyBanner />}
      <PageHeader
        title="Attendance Settings"
        subtitle="Configure grace period, shifts, overtime, and geofencing policy rules."
      />
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Geofencing Policy Card */}
        <Card className="lg:col-span-2">
          <div className="mb-2 text-sm font-bold flex items-center gap-2">
            <MapPin className="h-4 w-4 text-primary" /> Geofencing Policy
          </div>
          <p className="text-xs text-muted-foreground mb-4">
            Control whether location verification is enforced when employees record attendance.
          </p>

          <div className="space-y-4">
            {/* Enable Geofencing Master Toggle */}
            <div className="flex items-center justify-between rounded-lg border border-border p-3.5 bg-card">
              <div className="space-y-0.5 pr-4">
                <div className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <span>Enable Geofencing</span>
                  {f.enableGeofencing && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                      Enforced
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  Enforce location boundary verification when employees clock in.
                </div>
                {f.enableGeofencing && (
                  <div className="text-[11px] text-primary pt-1 font-medium">
                    ✓ Employees must be within an active GeoZone to clock in.
                  </div>
                )}
              </div>
              <button
                type="button"
                data-testid="toggle-enable-geofencing"
                disabled={!canEdit}
                onClick={() => setF((prev) => ({ ...prev, enableGeofencing: !prev.enableGeofencing }))}
                className="text-primary disabled:opacity-50 transition"
              >
                {f.enableGeofencing ? (
                  <ToggleRight className="h-7 w-7 text-primary" />
                ) : (
                  <ToggleLeft className="h-7 w-7 text-muted-foreground" />
                )}
              </button>
            </div>

            {/* Geofence on Clock-Out Toggle */}
            <div
              className={`flex items-center justify-between rounded-lg border border-border p-3.5 bg-card transition ${
                !f.enableGeofencing ? "opacity-60 bg-muted/30" : ""
              }`}
            >
              <div className="space-y-0.5 pr-4">
                <div className="text-sm font-semibold text-foreground">
                  Require Geofencing on Clock-Out
                </div>
                <div className="text-xs text-muted-foreground">
                  Require employees to be inside an authorized GeoZone when clocking out.
                </div>
                {!f.enableGeofencing && (
                  <div className="text-[11px] text-muted-foreground italic pt-1">
                    (Requires Enable Geofencing to be active)
                  </div>
                )}
              </div>
              <button
                type="button"
                data-testid="toggle-geofence-clock-out"
                disabled={!canEdit || !f.enableGeofencing}
                onClick={() => setF((prev) => ({ ...prev, geofenceOnClockOut: !prev.geofenceOnClockOut }))}
                className="text-primary disabled:opacity-50 transition"
              >
                {f.geofenceOnClockOut && f.enableGeofencing ? (
                  <ToggleRight className="h-7 w-7 text-primary" />
                ) : (
                  <ToggleLeft className="h-7 w-7 text-muted-foreground" />
                )}
              </button>
            </div>

            {/* Active GeoZone Empty State Warning */}
            {f.enableGeofencing && activeZonesCount === 0 && (
              <div
                data-testid="geozone-empty-warning"
                className="flex items-start gap-3 p-3.5 rounded-lg border border-amber-300 dark:border-amber-900/60 bg-amber-50/80 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200 text-xs"
              >
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1.5 flex-1">
                  <div className="font-semibold text-amber-900 dark:text-amber-200">
                    No active GeoZones configured
                  </div>
                  <div>
                    Geofencing is enabled, but no active GeoZones are configured. Add an authorized office location before employees clock in.
                  </div>
                  <a
                    href="/attendance/geo"
                    className="inline-flex items-center gap-1 font-semibold text-blue-600 dark:text-blue-400 hover:underline pt-1"
                  >
                    <span>Configure Geo-Fencing Zones</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </a>
                </div>
              </div>
            )}
          </div>
        </Card>

        <Card>
          <div className="mb-4 text-sm font-bold flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" /> Timing Rules
          </div>
          <div className="space-y-4">
            <Field label="Grace Period (minutes)">
              <input
                type="number"
                disabled={!canEdit}
                value={f.gracePeriod}
                onChange={(e) => setF({ ...f, gracePeriod: Number(e.target.value) })}
                className={inputCls}
              />
            </Field>
            <Field label="Half Day Threshold (minutes worked)">
              <input
                type="number"
                disabled={!canEdit}
                value={f.halfDayThreshold}
                onChange={(e) => setF({ ...f, halfDayThreshold: Number(e.target.value) })}
                className={inputCls}
              />
            </Field>
            <Field label="Overtime Multiplier">
              <input
                type="number"
                step="0.1"
                disabled={!canEdit}
                value={f.otMultiplier}
                onChange={(e) => setF({ ...f, otMultiplier: Number(e.target.value) })}
                className={inputCls}
              />
            </Field>
          </div>
        </Card>
        <Card>
          <div className="mb-4 text-sm font-bold flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" /> Shift Configuration
          </div>
          <div className="space-y-4">
            <Field label="Shift Name">
              <input
                disabled={!canEdit}
                value={f.shiftName}
                onChange={(e) => setF({ ...f, shiftName: e.target.value })}
                className={inputCls}
              />
            </Field>
            <Field label="Shift Start">
              <input
                type="time"
                disabled={!canEdit}
                value={f.shiftStart}
                onChange={(e) => setF({ ...f, shiftStart: e.target.value })}
                className={inputCls}
              />
            </Field>
            <Field label="Shift End">
              <input
                type="time"
                disabled={!canEdit}
                value={f.shiftEnd}
                onChange={(e) => setF({ ...f, shiftEnd: e.target.value })}
                className={inputCls}
              />
            </Field>
          </div>
        </Card>
        <Card>
          <div className="mb-4 text-sm font-bold flex items-center gap-2">
            <CalendarCheck className="h-4 w-4 text-primary" /> Week Off Days
          </div>
          <div className="grid grid-cols-4 gap-2">
            {days.map((d) => (
              <button
                key={d}
                disabled={!canEdit}
                onClick={() => toggleDay(d)}
                className={`rounded-lg border px-2 py-2 text-xs font-semibold transition ${f.weekOffs.includes(d) ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/50"} disabled:opacity-50`}
              >
                {d.slice(0, 3)}
              </button>
            ))}
          </div>
        </Card>
        <Card>
          <div className="mb-4 text-sm font-bold flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" /> Regularization
          </div>
          <div className="space-y-4">
            {[
              {
                key: "enableRegularization" as const,
                label: "Enable Regularization",
                desc: "Allow employees to request attendance correction",
              },
              {
                key: "selfRegularization" as const,
                label: "Self Regularization",
                desc: "Allow employees to self-approve corrections",
              },
            ].map((item) => (
              <div
                key={item.key}
                className="flex items-center justify-between rounded-lg border border-border p-3"
              >
                <div>
                  <div className="text-sm font-semibold">{item.label}</div>
                  <div className="text-xs text-muted-foreground">{item.desc}</div>
                </div>
                <button
                  disabled={!canEdit}
                  onClick={() => setF((prev) => ({ ...prev, [item.key]: !prev[item.key] }))}
                  className="text-primary disabled:opacity-50"
                >
                  {f[item.key] ? (
                    <ToggleRight className="h-7 w-7" />
                  ) : (
                    <ToggleLeft className="h-7 w-7 text-muted-foreground" />
                  )}
                </button>
              </div>
            ))}
          </div>
        </Card>
      </div>
      {canEdit && (
        <div className="mt-6 flex justify-end gap-2">
          <Btn
            variant="outline"
            onClick={() =>
              setF({
                gracePeriod: 15,
                halfDayThreshold: 240,
                otMultiplier: 1.5,
                enableRegularization: true,
                selfRegularization: false,
                enableGeofencing: false,
                geofenceOnClockOut: false,
                shiftName: "General",
                shiftStart: "09:00",
                shiftEnd: "18:00",
                weekOffs: ["Saturday", "Sunday"],
              })
            }
          >
            Reset
          </Btn>
          <Btn onClick={save} disabled={loading}>
            {loading ? "Saving..." : "Save Settings"}
          </Btn>
        </div>
      )}
    </div>
  );
}

function MatrixPage({
  departments,
  toast,
  user,
}: {
  departments: any[];
  toast: (m: string) => void;
  user: any;
}) {
  const months = useMemo(() => getRollingBusinessMonths(12), []);
  const [month, setMonth] = useState(() => months[0]);
  const [selectedDept, setSelectedDept] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDayDetail, setSelectedDayDetail] = useState<{
    date: string;
    employeeName: string;
    employeeId: string;
    status: string;
    detail: any;
  } | null>(null);

  const { data: matrixData, isLoading } = useAttendanceMatrixQuery(
    month,
    selectedDept,
    searchQuery,
  );

  const handleExportCSV = () => {
    if (!matrixData || !matrixData.records || matrixData.records.length === 0) {
      toast("No data available for export");
      return;
    }

    const days = matrixData.daysInMonth;
    const headers = ["Employee ID", "Name", "Department", "Designation"];
    for (let d = 1; d <= days; d++) {
      headers.push(d.toString());
    }

    const csvRows = [headers.join(",")];

    matrixData.records.forEach((row: any) => {
      const line = [
        `"${row.employeeId}"`,
        `"${row.employeeName}"`,
        `"${row.department}"`,
        `"${row.designation}"`,
      ];
      for (let d = 1; d <= days; d++) {
        const status = row.attendance[d]?.status || "—";
        line.push(`"${status}"`);
      }
      csvRows.push(line.join(","));
    });

    const csvContent = "data:text/csv;charset=utf-8," + csvRows.join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Attendance_Matrix_${month.replace(" ", "_")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast("CSV Export downloaded successfully!");
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Present":
        return "🟢";
      case "Absent":
        return "🔴";
      case "Half Day":
        return "🟠";
      case "Late":
        return "🟣";
      case "On Leave":
        return "🟡";
      case "Weekend":
        return "⚪";
      case "Holiday":
        return "🔵";
      case "Upcoming":
        return "–";
      default:
        return "—";
    }
  };

  const getStatusClass = (status: string) => {
    switch (status) {
      case "Present":
        return "text-green-500 font-bold bg-green-50/50 hover:bg-green-100/50 cursor-pointer";
      case "Absent":
        return "text-red-500 font-bold bg-red-50/50 hover:bg-red-100/50 cursor-pointer";
      case "Half Day":
        return "text-orange-500 font-bold bg-orange-50/50 hover:bg-orange-100/50 cursor-pointer";
      case "Late":
        return "text-purple-500 font-bold bg-purple-50/50 hover:bg-purple-100/50 cursor-pointer";
      case "On Leave":
        return "text-yellow-600 font-bold bg-yellow-50/50 hover:bg-yellow-100/50 cursor-pointer";
      case "Weekend":
        return "text-gray-300 bg-gray-50/40";
      case "Holiday":
        return "text-blue-400 bg-blue-50/30 hover:bg-blue-100/30 cursor-pointer";
      case "Upcoming":
        return "text-gray-300/40 bg-gray-50/10 cursor-not-allowed select-none";
      default:
        return "text-gray-200";
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Monthly Attendance Grid"
        subtitle="Month-wise view of employee attendance records with integrated filters and detailed daily logs."
        action={
          <div className="flex gap-2">
            <Btn variant="outline" onClick={handleExportCSV}>
              <span>Export CSV</span>
            </Btn>
          </div>
        }
      />

      <Card>
        <div className="grid gap-4 md:grid-cols-4 items-end">
          <Field label="Month">
            <select value={month} onChange={(e) => setMonth(e.target.value)} className={inputCls}>
              {months.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Department">
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className={inputCls}
            >
              <option value="All">All Departments</option>
              {departments.map((dept) => (
                <option key={dept.id} value={dept.name}>
                  {dept.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Search Employee">
            <input
              type="text"
              placeholder="Search by name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={inputCls}
            />
          </Field>
          <div className="flex justify-end">
            <Btn
              variant="outline"
              onClick={() => {
                setSelectedDept("All");
                setSearchQuery("");
              }}
              className="w-full md:w-auto"
            >
              Reset Filters
            </Btn>
          </div>
        </div>
      </Card>

      <Card className="py-3 px-4">
        <div className="flex flex-wrap gap-4 text-xs justify-between items-center text-muted-foreground">
          <div className="font-semibold text-foreground">Legend:</div>
          <div className="flex items-center gap-1">
            <span>🟢</span> <span className="font-medium text-foreground">Present</span>
          </div>
          <div className="flex items-center gap-1">
            <span>🔴</span> <span className="font-medium text-foreground">Absent</span>
          </div>
          <div className="flex items-center gap-1">
            <span>🟠</span> <span className="font-medium text-foreground">Half Day</span>
          </div>
          <div className="flex items-center gap-1">
            <span>🟣</span> <span className="font-medium text-foreground">Late</span>
          </div>
          <div className="flex items-center gap-1">
            <span>🟡</span> <span className="font-medium text-foreground">On Leave</span>
          </div>
          <div className="flex items-center gap-1">
            <span>⚪</span> <span className="font-medium text-foreground">Weekend</span>
          </div>
          <div className="flex items-center gap-1">
            <span>🔵</span> <span className="font-medium text-foreground">Holiday</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-gray-400 font-bold">–</span>{" "}
            <span className="font-medium text-muted-foreground">Upcoming</span>
          </div>
        </div>
      </Card>

      {isLoading ? (
        <Card className="p-16 text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent mx-auto mb-4" />
          <div className="text-sm text-muted-foreground">Loading attendance matrix data...</div>
        </Card>
      ) : !matrixData || !matrixData.records || matrixData.records.length === 0 ? (
        <Card className="p-16 text-center text-muted-foreground text-sm">
          No records found matching current criteria.
        </Card>
      ) : (
        <Card className="!p-0 overflow-hidden">
          <div className="overflow-x-auto max-h-[600px]">
            <table className="w-full text-xs text-center border-collapse">
              <thead className="bg-muted/40 sticky top-0 z-20">
                <tr className="border-b border-border text-left uppercase text-[10px] text-muted-foreground font-bold">
                  <th className="px-4 py-3 sticky left-0 bg-background border-r border-border min-w-[200px] z-30">
                    Employee Details
                  </th>
                  {Array.from({ length: matrixData.daysInMonth }, (_, i) => i + 1).map((day) => {
                    const { year, monthNum } = parseMonthString(month);
                    const dateStr = `${year}-${String(monthNum).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                    const isSunday = matrixData.sundays.includes(dateStr);
                    const isHoliday = matrixData.holidays.includes(dateStr);
                    return (
                      <th
                        key={day}
                        className={`px-1 py-3 min-w-[36px] text-center border-r border-border/40 ${isSunday ? "bg-red-50/30 text-red-500 font-extrabold" : isHoliday ? "bg-blue-50/30 text-blue-500 font-extrabold" : ""}`}
                      >
                        {day}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {matrixData.records.map((row: any) => (
                  <tr
                    key={row.employeeId}
                    className="border-b border-border/40 hover:bg-muted/10 transition"
                  >
                    <td className="px-3 py-2 text-left sticky left-0 bg-background border-r border-border min-w-[220px] z-10 shadow-[2px_0_5px_rgba(0,0,0,0.05)]">
                      <div className="flex items-center gap-2">
                        <Avatar
                          initials={(row.employeeName || "")
                            .split(" ")
                            .map((x: string) => x[0])
                            .join("")
                            .toUpperCase()
                            .slice(0, 2)}
                          size={26}
                        />
                        <div className="truncate flex-1">
                          <div className="font-bold text-foreground truncate max-w-[160px]">
                            {row.employeeName}
                          </div>
                          <div className="text-[10px] text-muted-foreground truncate max-w-[160px]">
                            {row.designation} · {row.department}
                          </div>
                        </div>
                      </div>
                      {row.summary && (
                        <div className="flex flex-wrap gap-[3px] mt-1.5 pl-[34px]">
                          {row.summary.present > 0 && (
                            <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-green-100/70 text-green-700">
                              P {row.summary.present}
                            </span>
                          )}
                          {row.summary.absent > 0 && (
                            <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-red-100/70 text-red-700">
                              A {row.summary.absent}
                            </span>
                          )}
                          {row.summary.halfDay > 0 && (
                            <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-orange-100/70 text-orange-700">
                              HD {row.summary.halfDay}
                            </span>
                          )}
                          {row.summary.late > 0 && (
                            <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-purple-100/70 text-purple-700">
                              L {row.summary.late}
                            </span>
                          )}
                          {row.summary.onLeave > 0 && (
                            <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-yellow-100/70 text-yellow-700">
                              OL {row.summary.onLeave}
                            </span>
                          )}
                          {row.summary.lopDays > 0 && (
                            <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-rose-100/80 text-rose-700 border border-rose-200">
                              LOP {row.summary.lopDays}
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                    {Array.from({ length: matrixData.daysInMonth }, (_, i) => i + 1).map((day) => {
                      const dayDetail = row.attendance[day] || { status: "—" };
                      return (
                        <td
                          key={day}
                          onClick={() => {
                            if (dayDetail.status === "Upcoming") return;
                            const dateStr = `${day} ${month}`;
                            setSelectedDayDetail({
                              date: dateStr,
                              employeeName: row.employeeName,
                              employeeId: row.employeeId,
                              status: dayDetail.status,
                              detail: dayDetail,
                            });
                          }}
                          className={`border-r border-border/30 p-1 text-center font-bold transition ${
                            dayDetail.status !== "Upcoming" && dayDetail.status !== "Weekend"
                              ? "hover:scale-110 duration-75"
                              : ""
                          } ${getStatusClass(dayDetail.status)}`}
                          title={
                            dayDetail.status === "Upcoming"
                              ? `${day} ${month} — not yet reached`
                              : `${row.employeeName} on ${day} ${month}: ${dayDetail.status}`
                          }
                        >
                          {getStatusBadge(dayDetail.status)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {selectedDayDetail && (
        <ModalShell
          title="Daily Attendance Details"
          onClose={() => setSelectedDayDetail(null)}
          wide
        >
          <div className="space-y-4">
            <div className="flex items-center gap-3 pb-3 border-b border-border">
              <Avatar
                initials={(selectedDayDetail.employeeName || "")
                  .split(" ")
                  .map((x: string) => x[0])
                  .join("")
                  .toUpperCase()
                  .slice(0, 2)}
                size={40}
              />
              <div>
                <div className="font-bold text-base text-foreground">
                  {selectedDayDetail.employeeName}
                </div>
                <div className="text-xs text-muted-foreground">
                  ID: {selectedDayDetail.employeeId} · Date: {selectedDayDetail.date}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div className="flex justify-between items-center bg-muted/30 p-2.5 rounded-lg border border-border/50">
                  <span className="text-xs text-muted-foreground font-medium">Status</span>
                  <Badge
                    tone={
                      selectedDayDetail.status === "Present"
                        ? "green"
                        : selectedDayDetail.status === "Absent"
                          ? "rose"
                          : selectedDayDetail.status === "Half Day"
                            ? "indigo"
                            : selectedDayDetail.status === "Late"
                              ? "indigo"
                              : selectedDayDetail.status === "On Leave"
                                ? "amber"
                                : "slate"
                    }
                  >
                    {selectedDayDetail.status}
                  </Badge>
                </div>
                <div className="flex justify-between items-center bg-muted/30 p-2.5 rounded-lg border border-border/50">
                  <span className="text-xs text-muted-foreground font-medium">Check-In Time</span>
                  <span className="text-xs font-semibold text-foreground">
                    {selectedDayDetail.detail.checkIn || "—"}
                  </span>
                </div>
                <div className="flex justify-between items-center bg-muted/30 p-2.5 rounded-lg border border-border/50">
                  <span className="text-xs text-muted-foreground font-medium">Check-Out Time</span>
                  <span className="text-xs font-semibold text-foreground">
                    {selectedDayDetail.detail.checkOut || "—"}
                  </span>
                </div>
                <div className="flex justify-between items-center bg-muted/30 p-2.5 rounded-lg border border-border/50">
                  <span className="text-xs text-muted-foreground font-medium">Working Hours</span>
                  <span className="text-xs font-semibold text-foreground">
                    {selectedDayDetail.detail.hours || "—"}
                  </span>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center bg-muted/30 p-2.5 rounded-lg border border-border/50">
                  <span className="text-xs text-muted-foreground font-medium">
                    Verification Method
                  </span>
                  <Badge tone="sky">{selectedDayDetail.detail.method || "—"}</Badge>
                </div>
                <div className="flex justify-between items-center bg-muted/30 p-2.5 rounded-lg border border-border/50">
                  <span className="text-xs text-muted-foreground font-medium">Device ID / IP</span>
                  <span className="text-xs font-semibold text-foreground truncate max-w-[150px]">
                    {selectedDayDetail.detail.deviceId || selectedDayDetail.detail.ipAddress || "—"}
                  </span>
                </div>
                <div className="flex justify-between items-center bg-muted/30 p-2.5 rounded-lg border border-border/50">
                  <span className="text-xs text-muted-foreground font-medium">Geo-Location</span>
                  <span className="text-xs font-semibold text-foreground">
                    {selectedDayDetail.detail.latitude && selectedDayDetail.detail.longitude
                      ? `${Number(selectedDayDetail.detail.latitude).toFixed(4)}, ${Number(selectedDayDetail.detail.longitude).toFixed(4)}`
                      : "—"}
                  </span>
                </div>
                <div className="flex justify-between items-center bg-muted/30 p-2.5 rounded-lg border border-border/50">
                  <span className="text-xs text-muted-foreground font-medium">Remarks</span>
                  <span
                    className="text-xs font-semibold text-foreground truncate max-w-[150px]"
                    title={selectedDayDetail.detail.remarks}
                  >
                    {selectedDayDetail.detail.remarks || "No remarks"}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <Btn onClick={() => setSelectedDayDetail(null)}>Close</Btn>
            </div>
          </div>
        </ModalShell>
      )}
    </div>
  );
}

export function AttendancePage(p: { sub: string; user?: any; toast?: any; triggerConfirm?: any }) {
  const { sub, user, toast, triggerConfirm } = p;
  const { data: departmentsData } = useDepartmentsQuery();
  const departments = departmentsData || [];

  const { data: employeesData, employees: employeesProp } = useEmployeesQuery();
  const employees: Employee[] = Array.isArray(employeesProp) && employeesProp.length > 0
    ? employeesProp
    : (Array.isArray(employeesData)
        ? employeesData
        : (employeesData && Array.isArray((employeesData as any).data) ? (employeesData as any).data : (Array.isArray(employeesProp) ? employeesProp : [])));
  const { data: devicesData } = useDevicesQuery();
  const devices = devicesData || [];
  const { data: zonesData } = useZonesQuery();
  const zones = zonesData || [];
  const { records: attendanceRecords = [] } = useAttendanceQuery();
  const { clockInOrOut } = useAttendanceMutations();
  const clockInOut = clockInOrOut.mutateAsync;

  const canEditBiogeo = hasPermission(user, PERMISSIONS.EMPLOYEES_ATTENDANCE_EDIT) || isSuperAdmin(user);
  const canEditManual = hasPermission(user, PERMISSIONS.EMPLOYEES_ATTENDANCE_REGULARIZE) || isSuperAdmin(user);
  const scopeToTeam = user.role === "Manager";
  const scopeToSelf = user.role === "Employee";

  const managerEmployee =
    employees.find((e) => Boolean(user.id && (e.userId === user.id || e.user?.id === user.id))) ??
    employees.find((e) => Boolean(user.email && e.email === user.email));

  const visibleEmployees = scopeToTeam
    ? managerEmployee
      ? Array.from(
          new Map(
            [
              managerEmployee,
              ...employees.filter((e) => e.managerId === managerEmployee.id),
            ].map((e) => [e.id, e]),
          ).values(),
        )
      : []
    : scopeToSelf
      ? employees.filter((e) => e.name === user.name || Boolean(user.email && e.email === user.email))
      : employees;

  if (sub === "attendance.manual")
    return (
      <ManualAttendancePage
        employees={visibleEmployees}
        canEdit={canEditManual}
        toast={toast}
        attendanceRecords={attendanceRecords}
        clockInOut={clockInOut}
      />
    );
  if (sub === "attendance.biometric")
    return (
      <BiometricPage
        devices={devices}
        canEdit={canEditBiogeo}
        toast={toast}
        triggerConfirm={triggerConfirm}
      />
    );
  if (sub === "attendance.geo")
    return (
      <GeoPage
        zones={zones}
        canEdit={canEditBiogeo}
        toast={toast}
        triggerConfirm={triggerConfirm}
      />
    );
  if (sub === "attendance.history")
    return (
      <HistoryPage
        employees={visibleEmployees}
        isSelf={!!scopeToSelf}
        userName={user.name}
        attendanceRecords={attendanceRecords}
      />
    );
  if (sub === "attendance.matrix")
    return <MatrixPage departments={departments} toast={toast} user={user} />;
  if (sub === "attendance.settings")
    return (
      <AttendanceSettingsPage
        toast={toast}
        canEdit={canEditBiogeo}
        zones={zones}
      />
    );

  const today = getBusinessDateString();
  const { presentCount, absentCount, halfDayCount, onLeaveCount, lateCount } = calcAttendanceStats(
    visibleEmployees,
    attendanceRecords,
    today,
  );

  const kpis = [
    { label: "Present", val: presentCount, tone: "green" as BadgeTone, icon: Check },
    { label: "Absent", val: absentCount, tone: "rose" as BadgeTone, icon: X },
    { label: "Half Day", val: halfDayCount, tone: "indigo" as BadgeTone, icon: Clock },
    { label: "On Leave", val: onLeaveCount, tone: "amber" as BadgeTone, icon: CalendarDays },
    { label: "Late", val: lateCount, tone: "indigo" as BadgeTone, icon: Clock },
  ];

  return (
    <div>
      <PageHeader
        title={scopeToTeam ? `Team Attendance - ${user.department}` : "Attendance Overview"}
        subtitle="Real-time attendance across the organization."
      />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {kpis.map((k) => {
          const I = k.icon;
          return (
            <Card key={k.label}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-3xl font-bold">{k.val}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{k.label}</div>
                </div>
                <div className="grid h-11 w-11 place-items-center rounded-xl bg-muted">
                  <I className="h-5 w-5" />
                </div>
              </div>
              <div className="mt-3">
                <Badge tone={k.tone}>Today</Badge>
              </div>
            </Card>
          );
        })}
      </div>
      <div className="mt-6">
        <Card>
          <div className="mb-4 text-sm font-bold">Today's Check-ins</div>
          <div className="space-y-2">
            {visibleEmployees.map((e) => {
              const record = attendanceRecords?.find(
                (r: any) => r.employeeId === e.id && r.date === today,
              );
              if (!record || record.status === "Absent" || record.status === "On Leave")
                return null;
              const method = record.verificationType || "Manual";
              let badgeTone: "green" | "rose" | "indigo" | "amber" = "green";
              if (record.status === "Late") badgeTone = "amber";
              if (record.status === "Half Day") badgeTone = "indigo";
              return (
                <div
                  key={e.id}
                  className="flex items-center justify-between rounded-lg border border-border p-3"
                >
                  <div className="flex items-center gap-3">
                    <Avatar initials={e.avatar} />
                    <div>
                      <div className="text-sm font-semibold">{e.name}</div>
                      <div className="text-xs text-muted-foreground">{e.department}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="text-muted-foreground">In: {record.checkIn}</span>
                    <Badge tone="indigo">{method}</Badge>
                    <Badge tone={badgeTone}>{record.status}</Badge>
                  </div>
                </div>
              );
            })}
            {!visibleEmployees.some((e) => {
              const r = attendanceRecords?.find(
                (rec: any) => rec.employeeId === e.id && rec.date === today,
              );
              return r && r.status !== "Absent" && r.status !== "On Leave";
            }) && (
              <div className="text-muted-foreground text-sm text-center py-4">
                No check-ins yet today.
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

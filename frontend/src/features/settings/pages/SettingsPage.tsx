import { useState, useEffect } from "react";
import { hasPermission, isSuperAdmin, PERMISSIONS, ProtectedRoute } from "../../../auth";
import {
  Plus,
  Trash2,
  Check,
  ShieldCheck,
  Fingerprint,
  MapPin,
  CalendarPlus,
  Wallet,
  User as UserIcon,
} from "lucide-react";
import {
  PageHeader,
  Card,
  Btn,
  Badge,
  Field,
  inputCls,
  ReadOnlyBanner,
  ModalShell,
} from "../../../components/ui";
import type { Holiday, BadgeTone } from "../../../types";
import { useUIStore } from "../../../store";
import { FiscalYearPage } from "./FiscalYearPage";
import { SecurityConfigPage } from "./SecurityConfigPage";
import { DataBackupPage } from "./DataBackupPage";
import { AuditLogPage } from "./AuditLogPage";
import { SystemHealthPage } from "./SystemHealthPage";
import { BillingSubPage } from "../../payroll/pages/BillingSubPage";
import { EntityBranchPage } from "./EntityBranchPage";
import { UserRoleMgmtPage } from "./UserRoleMgmtPage";
import { useOrgStore } from "../../../store";
import { settingsService } from "../../../services/settings.service";

export function SettingsPage(p: { sub: string; toast: any; user: any }) {
  const { sub, toast, user } = p;
  const users = useOrgStore((s) => s.users);
  const setUsers = useOrgStore((s) => s.setUsers);
  const canEditSettings = hasPermission(user, PERMISSIONS.SETTINGS_COMPANY_EDIT) || isSuperAdmin(user);
  const canViewHolidays = hasPermission(user, PERMISSIONS.SETTINGS_COMPANY_VIEW) || isSuperAdmin(user);
  const canEditHolidays = hasPermission(user, PERMISSIONS.SETTINGS_COMPANY_EDIT) || isSuperAdmin(user);
  const canViewRoles = hasPermission(user, PERMISSIONS.SETTINGS_ROLES_VIEW) || isSuperAdmin(user);

  const [compSettings, setCompSettings] = useState<any>(null);
  const [form, setForm] = useState({
    name: (user as any).companyName || "Acme Corp",
    legal: "",
    email: "",
    phone: "",
    address: "",
  });

  useEffect(() => {
    if (sub === "settings.company" || !sub) {
      settingsService
        .getCompanySettings()
        .then((data) => {
          setCompSettings(data);
          setForm({
            name: (user as any).companyName || "Acme Corp",
            legal: data.legalName || "",
            email: data.email || "",
            phone: data.phone || "",
            address: data.address || "",
          });
        })
        .catch(() => {});
    }
  }, [sub, user]);

  const saveCompany = async () => {
    if (!compSettings) return;
    try {
      const updated = await settingsService.updateCompanySettings(
        compSettings.id,
        compSettings.version,
        {
          legalName: form.legal,
          email: form.email,
          phone: form.phone,
          address: form.address,
        },
      );
      setCompSettings(updated);
      toast("Company profile saved successfully.");
    } catch (err: any) {
      toast(err.message || "Failed to save company profile.", "error");
    }
  };

  if (sub === "settings.timing" && canEditSettings) return <TimingPage toast={toast} />;
  if (sub === "settings.holidays" && canViewHolidays)
    return <HolidaysPage canEdit={canEditHolidays} toast={toast} />;
  if (sub === "settings.roles")
    return (
      <div className="text-center py-16 text-muted-foreground">
        Access denied. Only Super Admins can manage roles & permissions.
      </div>
    );
  if (sub === "settings.branches") return <EntityBranchPage toast={toast} />;
  if (sub === "settings.fiscal") return <FiscalYearPage toast={toast} />;
  if (sub === "settings.billing") return <BillingSubPage toast={toast} />;
  if (sub === "settings.security") return <SecurityConfigPage toast={toast} />;
  if (sub === "settings.data") return <DataBackupPage toast={toast} />;
  if (sub === "settings.audit") {
    return (
      <ProtectedRoute permission={PERMISSIONS.SYSTEM_AUDIT_VIEW}>
        <AuditLogPage />
      </ProtectedRoute>
    );
  }
  if (sub === "settings.health") return <SystemHealthPage />;

  return (
    <div>
      {!canEditSettings && <ReadOnlyBanner />}
      <PageHeader title="Company Settings" subtitle="Organization profile and branding." />
      <Card>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Company Name">
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className={inputCls}
              disabled={true}
            />
          </Field>
          <Field label="Legal Name">
            <input
              value={form.legal}
              onChange={(e) => setForm({ ...form, legal: e.target.value })}
              className={inputCls}
              disabled={!canEditSettings}
            />
          </Field>
          <Field label="Email">
            <input
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className={inputCls}
              disabled={!canEditSettings}
            />
          </Field>
          <Field label="Phone">
            <input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className={inputCls}
              disabled={!canEditSettings}
            />
          </Field>
          <Field label="Address" className="md:col-span-2">
            <textarea
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              className={inputCls + " min-h-[80px] py-2"}
              disabled={!canEditSettings}
            />
          </Field>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Btn variant="outline">Reset</Btn>
          {canEditSettings && <Btn onClick={saveCompany}>Save Changes</Btn>}
        </div>
      </Card>
    </div>
  );
}

function TimingPage({ toast }: { toast: (m: string, t?: "success" | "error" | "info") => void }) {
  const [timingRecord, setTimingRecord] = useState<any>(null);
  const [f, setF] = useState({ start: "09:00", end: "18:00", brk: 60, late: 15 });

  useEffect(() => {
    settingsService
      .getOfficeTiming()
      .then((data) => {
        setTimingRecord(data);
        setF({
          start: data.startTime || "09:00",
          end: data.endTime || "18:00",
          brk: data.breakDuration || 60,
          late: data.lateThreshold || 15,
        });
      })
      .catch(() => {});
  }, []);

  const saveTiming = async () => {
    if (!timingRecord) return;
    try {
      const updated = await settingsService.updateOfficeTiming(
        timingRecord.id,
        timingRecord.version,
        {
          startTime: f.start,
          endTime: f.end,
          breakDuration: f.brk,
          lateThreshold: f.late,
        },
      );
      setTimingRecord(updated);
      toast("Office timings saved successfully.");
    } catch (err: any) {
      toast(err.message || "Failed to save office timings.", "error");
    }
  };

  return (
    <div>
      <PageHeader title="Office Timing" subtitle="Define working hours and shifts." />
      <Card>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Start Time">
            <input
              type="time"
              value={f.start}
              onChange={(e) => setF({ ...f, start: e.target.value })}
              className={inputCls}
            />
          </Field>
          <Field label="End Time">
            <input
              type="time"
              value={f.end}
              onChange={(e) => setF({ ...f, end: e.target.value })}
              className={inputCls}
            />
          </Field>
          <Field label="Break (min)">
            <input
              type="number"
              value={f.brk}
              onChange={(e) => setF({ ...f, brk: Number(e.target.value) })}
              className={inputCls}
            />
          </Field>
          <Field label="Late Threshold (min)">
            <input
              type="number"
              value={f.late}
              onChange={(e) => setF({ ...f, late: Number(e.target.value) })}
              className={inputCls}
            />
          </Field>
        </div>
        <div className="mt-6 flex justify-end">
          <Btn onClick={saveTiming}>Save</Btn>
        </div>
      </Card>
    </div>
  );
}

function HolidaysPage({
  canEdit,
  toast,
}: {
  canEdit: boolean;
  toast: (m: string, t?: "success" | "error" | "info") => void;
}) {
  const [holidays, setHolidays] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ d: "", o: "", t: "Festival" });

  const loadHolidays = () => {
    settingsService
      .getHolidays()
      .then((data) => {
        setHolidays(data);
      })
      .catch(() => {});
  };

  useEffect(() => {
    loadHolidays();
  }, []);

  const add = async () => {
    if (!f.d.trim() || !f.o.trim()) return;
    try {
      const enumType = String(f.t).toUpperCase();
      await settingsService.addHoliday({
        date: f.d,
        occasion: f.o,
        type: enumType,
      });
      toast("Holiday added successfully.");
      setOpen(false);
      setF({ d: "", o: "", t: "Festival" });
      loadHolidays();
    } catch (err: any) {
      toast(err.message || "Failed to add holiday.", "error");
    }
  };

  const deleteHoliday = (h: Holiday) => {
    if (!h.id) return;
    useUIStore.getState().setConfirmState({
      open: true,
      title: "Delete Holiday",
      message: `Are you sure you want to delete "${h.occasion}" on ${new Date(h.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}? This action cannot be undone.`,
      confirmText: "Delete Holiday",
      cancelText: "Cancel",
      confirmVariant: "danger",
      onConfirm: async () => {
        try {
          await settingsService.deleteHoliday(h.id!);
          toast("Holiday deleted successfully.");
          loadHolidays();
        } catch (err: any) {
          toast(err.message || "Failed to delete holiday.", "error");
        }
      },
    });
  };

  return (
    <div>
      {!canEdit && <ReadOnlyBanner />}
      <PageHeader
        title="Holidays"
        subtitle="Company holiday calendar for 2026."
        action={
          canEdit && (
            <Btn onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4" /> Add Holiday
            </Btn>
          )
        }
      />
      <Card className="!p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-left text-xs uppercase text-muted-foreground">
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Occasion</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {holidays.map((h) => (
              <tr key={h.id} className="border-b border-border/60">
                <td className="px-4 py-3 font-semibold">
                  {new Date(h.date).toLocaleDateString("en-IN", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                </td>
                <td className="px-4 py-3">{h.occasion}</td>
                <td className="px-4 py-3">
                  <Badge tone="indigo">{h.type}</Badge>
                </td>
                <td className="px-4 py-3 text-right">
                  {canEdit && (
                    <Btn
                      variant="outline"
                      size="sm"
                      onClick={() => deleteHoliday(h)}
                      className="text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Btn>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      {open && (
        <ModalShell title="Add Holiday" onClose={() => setOpen(false)}>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="Date">
              <input
                type="date"
                value={f.d}
                onChange={(e) => setF({ ...f, d: e.target.value })}
                className={inputCls}
              />
            </Field>
            <Field label="Type">
              <select
                value={f.t}
                onChange={(e) => setF({ ...f, t: e.target.value })}
                className={inputCls}
              >
                <option>Festival</option>
                <option>National</option>
                <option>Regional</option>
              </select>
            </Field>
            <Field className="md:col-span-2" label="Occasion">
              <input
                value={f.o}
                onChange={(e) => setF({ ...f, o: e.target.value })}
                className={inputCls}
                placeholder="e.g. Children's Day"
              />
            </Field>
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <Btn variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Btn>
            <Btn onClick={add}>Add</Btn>
          </div>
        </ModalShell>
      )}
    </div>
  );
}

function RolesPage({ canEdit, toast }: { canEdit: boolean; toast: (m: string) => void }) {
  const [roles, setRoles] = useState([
    {
      r: "Super Admin",
      u: 1,
      p: "Full access to all modules and settings",
      badge: "rose" as BadgeTone,
    },
    {
      r: "HR Admin",
      u: 2,
      p: "Employee, attendance, leave, payroll, documents",
      badge: "indigo" as BadgeTone,
    },
    {
      r: "Manager",
      u: 5,
      p: "Team dashboard, approve team leaves, view team payroll",
      badge: "sky" as BadgeTone,
    },
    {
      r: "Accountant",
      u: 2,
      p: "Full payroll, read-only employees & reports",
      badge: "amber" as BadgeTone,
    },
    {
      r: "Employee",
      u: 36,
      p: "Self-service: own profile, leave, payslip, documents",
      badge: "green" as BadgeTone,
    },
    {
      r: "Viewer / HR Staff",
      u: 3,
      p: "Read-only access to HR modules, export reports",
      badge: "slate" as BadgeTone,
    },
  ]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const add = () => {
    if (!name.trim()) return;
    setRoles((prev) => [
      ...prev,
      { r: name.trim(), u: 0, p: "Custom role", badge: "slate" as BadgeTone },
    ]);
    toast("Role added");
    setOpen(false);
    setName("");
  };
  return (
    <div>
      <PageHeader
        title="Roles & Permissions"
        subtitle="Manage access control for your team."
        action={
          canEdit && (
            <Btn onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4" /> New Role
            </Btn>
          )
        }
      />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {roles.map((r) => (
          <Card key={r.r}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl btn-gradient">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <div className="truncate font-bold">{r.r}</div>
                  <div className="text-xs text-muted-foreground">{r.u} users</div>
                </div>
              </div>
              <Badge tone={r.badge}>{r.u}</Badge>
            </div>
            <div className="mt-4 text-xs text-muted-foreground">{r.p}</div>
          </Card>
        ))}
      </div>
      {open && (
        <ModalShell title="New Role" onClose={() => setOpen(false)}>
          <Field label="Role Name *">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputCls}
              placeholder="e.g. Team Lead"
            />
          </Field>
          <div className="mt-6 flex justify-end gap-2">
            <Btn variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Btn>
            <Btn onClick={add}>Create</Btn>
          </div>
        </ModalShell>
      )}
    </div>
  );
}

function MobilePage() {
  return (
    <div>
      <PageHeader title="Mobile App" subtitle="Preview of the employee mobile experience." />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <div className="text-sm font-bold mb-4">Features</div>
          <div className="space-y-3">
            {[
              { icon: Fingerprint, t: "Biometric Login", d: "Face ID / Touch ID authentication" },
              { icon: MapPin, t: "Geo Check-in", d: "Auto check-in inside office fence" },
              { icon: CalendarPlus, t: "Apply Leave", d: "Quick leave requests on the go" },
              { icon: Wallet, t: "Salary Slips", d: "Access payslips instantly" },
              { icon: UserIcon, t: "Profile", d: "Update personal information" },
            ].map((f) => {
              const I = f.icon;
              return (
                <div
                  key={f.t}
                  className="flex items-center gap-3 rounded-lg border border-border p-3 transition hover:-translate-y-0.5 hover:border-primary"
                >
                  <div className="grid h-10 w-10 place-items-center rounded-lg btn-gradient">
                    <I className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold">{f.t}</div>
                    <div className="text-xs text-muted-foreground">{f.d}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
        <Card className="flex items-center justify-center bg-gradient-to-br from-primary/5 to-primary-glow/5">
          <div className="w-64 rounded-[2.5rem] border-8 border-foreground/80 bg-background p-4 shadow-2xl">
            <div className="mx-auto mb-3 h-1 w-16 rounded-full bg-muted-foreground/40" />
            <div className="rounded-2xl btn-gradient p-4">
              <div className="text-xs opacity-70">Good morning</div>
              <div className="text-lg font-bold">Deepak Bhagat</div>
              <div className="mt-3 rounded-xl bg-white/10 p-3 backdrop-blur">
                <div className="text-xs">Check-in</div>
                <div className="text-2xl font-bold">09:12 AM</div>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              {["Leave", "Salary", "Profile", "Team"].map((t) => (
                <div key={t} className="rounded-lg bg-muted p-3 text-center font-semibold">
                  {t}
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

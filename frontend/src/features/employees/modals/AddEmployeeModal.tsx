import React, { useState, useEffect } from "react";
import { getBusinessDateString } from "../../../utils/date.utils";
import { User as UserIcon, Check } from "lucide-react";
import {
  ModalShell,
  Field,
  Btn,
  inputCls,
  nameInputProps,
  dateInputProps,
} from "../../../components/ui";
import type { Employee } from "../../../types";
import { authService } from "../../../services/auth.service";
import { employeeService } from "../../../services/employee.service";
import { subscriptionService } from "../../../services/subscription.service";
import { useUIStore } from "../../../store";

interface AddEmployeeModalProps {
  onClose: () => void;
  onSave: (
    e: Omit<Employee, "id" | "avatar"> & { id?: string },
    isEdit?: boolean,
  ) => Promise<boolean>;
  departments: string[];
  designations: string[];
  editing?: Employee;
  employeeCount?: number;
  isPage?: boolean;
}

export function AddEmployeeModal({
  onClose,
  onSave,
  departments,
  designations,
  editing,
  employeeCount,
  isPage,
}: AddEmployeeModalProps) {
  const [dbRoles, setDbRoles] = useState<{ id: string; name: string }[]>([]);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [rolesError, setRolesError] = useState<string | null>(null);
  const [managers, setManagers] = useState<Employee[]>([]);
  const [usage, setUsage] = useState<{ used: number; limit: number } | null>(null);

  useEffect(() => {
    let isMounted = true;
    setRolesLoading(true);
    authService
      .getAssignableRoles()
      .then((data) => {
        if (isMounted) {
          setDbRoles(data || []);
          setRolesError(null);
        }
      })
      .catch((err) => {
        if (isMounted) {
          console.error("Failed to load assignable roles:", err);
          setDbRoles([]);
          setRolesError(err?.message || "Failed to load access roles");
        }
      })
      .finally(() => {
        if (isMounted) setRolesLoading(false);
      });

    employeeService
      .getEmployees()
      .then((data) => {
        if (isMounted) setManagers(Array.isArray(data?.data) ? data.data : (Array.isArray(data) ? data : []));
      })
      .catch((err) => {
        console.error("Failed to load managers:", err);
      });

    if (!editing) {
      subscriptionService
        .getMyUsage()
        .then((data) => {
          if (isMounted && data && data.employees) {
            setUsage({
              used: data.employees.used,
              limit: data.employees.limit,
            });
          }
        })
        .catch((err) => {
          console.error("Failed to load subscription usage:", err);
        });
    }

    return () => {
      isMounted = false;
    };
  }, [editing]);

  const [form, setForm] = useState({
    id: editing?.id,
    name: editing?.name || "",
    email: editing?.email || "",
    department: editing?.department || departments[0] || "",
    designation: editing?.designation || designations[0] || "",
    status: (editing?.status || "Active") as Employee["status"],
    joined: editing?.joined || getBusinessDateString(),
    salary: editing?.salary || 60000,
    phone: editing?.phone || "",
    address: editing?.address || "",
    dob: editing?.dob || "",
    gender: editing?.gender || "Male",
    location: editing?.location || "",
    uan: editing?.uan || "",
    esic: editing?.esic || "",
    pan: editing?.pan || "",
    aadhaar: editing?.aadhaar || "",
    createAccount: editing ? !!editing.user : true,
    roleId: editing?.user?.roleId || "",
    managerId: editing?.managerId || "",
  });

  const getSmartId = () => {
    if (editing?.id) return editing.id;
    const locClean = form.location.replace(/[^a-zA-Z]/g, "").toUpperCase();
    const locCode = locClean.length >= 2 ? locClean.substring(0, 3) : "HQ";
    const deptClean = form.department.replace(/[^a-zA-Z]/g, "").toUpperCase();
    const deptCode = deptClean.length >= 2 ? deptClean.substring(0, 3) : "GEN";
    const seq = String((employeeCount || 0) + 1).padStart(3, "0");
    return `${locCode}-${deptCode}-${seq}`;
  };
  const autoEmpId = getSmartId();

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!editing && usage && usage.used >= usage.limit) {
      useUIStore.getState().setEmpModal({ open: false });
      useUIStore.getState().setSeatLimitModal({
        open: true,
        message:
          "Your company has reached its employee seat limit. Upgrade your subscription or free an existing seat before adding another employee.",
        purchasedSeats: usage.limit,
        usedSeats: usage.used,
      });
      return;
    }

    const errs: Record<string, string> = {};
    if (!form.name.trim()) {
      errs.name = "Required";
    } else if (form.name.length > 250) {
      errs.name = "Name must not exceed 250 characters";
    } else if (/[^a-zA-Z\s]/.test(form.name)) {
      errs.name = "Name must contain only alphabets and spaces";
    }

    if (!form.email.trim()) {
      errs.email = "Required";
    } else if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(form.email)) {
      errs.email = "Invalid input or unsupported characters";
    }

    if (!form.department) {
      errs.department = "Department is required";
    }

    if (!form.designation) {
      errs.designation = "Designation is required";
    }

    if (form.createAccount && !form.roleId) {
      errs.roleId = "Role is required for user account creation";
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.joined)) {
      errs.joined = "Invalid date";
    }

    if (form.salary <= 0) {
      errs.salary = "Monthly Salary must be positive";
    }

    if (form.dob) {
      const dobDate = new Date(form.dob);
      if (dobDate > new Date()) {
        errs.dob = "Future DOB is not allowed";
      }
    }

    if (form.phone.trim()) {
      const phoneClean = form.phone.replace(/[\s\-\+]/g, "");
      if (!/^\d+$/.test(phoneClean)) {
        errs.phone = "Phone must only contain digits";
      } else if (phoneClean.length < 10 || phoneClean.length > 15) {
        errs.phone = "Phone must be 10 to 15 digits";
      }
    }

    if (form.uan.trim()) {
      if (!/^\d+$/.test(form.uan)) {
        errs.uan = "UAN must contain only digits";
      } else if (form.uan.length !== 12) {
        errs.uan = "UAN must be exactly 12 digits";
      }
    }

    if (form.pan.trim()) {
      const panUpper = form.pan.toUpperCase();
      if (!/^[A-Z]{5}\d{4}[A-Z]$/.test(panUpper)) {
        errs.pan = "PAN must follow standard format (e.g. ABCDE1234F)";
      }
    }

    if (form.aadhaar.trim()) {
      const aadhaarClean = form.aadhaar.replace(/\s/g, "");
      if (!/^\d+$/.test(aadhaarClean)) {
        errs.aadhaar = "Aadhaar must contain only digits";
      } else if (aadhaarClean.length !== 12) {
        errs.aadhaar = "Aadhaar must be exactly 12 digits";
      }
    }

    setErrors(errs);
    if (Object.keys(errs).length) return;

    setLoading(true);
    try {
      const success = await onSave({ ...form, id: autoEmpId }, !!editing);
      if (success) {
        onClose();
      }
    } catch {
      // Keep open on error
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalShell
      title={editing ? `Edit Employee — ${editing.id}` : "Add New Employee"}
      onClose={onClose}
      wide
    >
      {/* Employee ID Banner */}
      <div className="mb-5 flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg btn-gradient">
          <UserIcon className="h-4 w-4" />
        </div>
        <div>
          <div className="text-xs text-muted-foreground font-medium">
            Auto-generated Employee ID
          </div>
          <div className="text-lg font-bold tracking-wider text-primary">{autoEmpId}</div>
        </div>
        <div className="ml-auto text-xs text-muted-foreground">Used across all HRMS modules</div>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label="Full Name *" error={errors.name}>
          <input
            {...nameInputProps(form.name, (v) => setForm({ ...form, name: v }))}
            placeholder="e.g. Jane Doe"
            className={inputCls}
          />
        </Field>
        <Field label="Email *" error={errors.email}>
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="jane@acme.co"
            className={inputCls}
          />
        </Field>
        <Field label="Date of Birth" error={errors.dob}>
          <input
            {...dateInputProps(form.dob, (v) => setForm({ ...form, dob: v }))}
            className={inputCls}
            max={getBusinessDateString()}
          />
        </Field>
        <Field label="Gender">
          <select
            value={form.gender}
            onChange={(e) => setForm({ ...form, gender: e.target.value })}
            className={inputCls}
          >
            <option>Male</option>
            <option>Female</option>
            <option>Other</option>
            <option>Prefer not to say</option>
          </select>
        </Field>
        <Field label="Location / Branch">
          <input
            value={form.location}
            onChange={(e) => setForm({ ...form, location: e.target.value })}
            className={inputCls}
            placeholder="e.g. Head Office / Bangalore / Branch"
          />
        </Field>
        <Field label="Department *" error={errors.department}>
          <select
            value={form.department}
            onChange={(e) => setForm({ ...form, department: e.target.value })}
            className={inputCls}
          >
            {!form.department && <option value="">— Select Department —</option>}
            {departments.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
        </Field>
        <Field label="Designation *" error={errors.designation}>
          <select
            value={form.designation}
            onChange={(e) => setForm({ ...form, designation: e.target.value })}
            className={inputCls}
          >
            {!form.designation && <option value="">— Select Designation —</option>}
            {designations.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
        </Field>
        <Field label="Join Date *" error={errors.joined}>
          <input
            {...dateInputProps(form.joined, (v) => setForm({ ...form, joined: v }))}
            className={inputCls}
          />
        </Field>
        <Field label="Monthly Salary (₹) *" error={errors.salary}>
          <input
            type="number"
            value={form.salary}
            onChange={(e) => setForm({ ...form, salary: Number(e.target.value) })}
            className={inputCls}
          />
        </Field>
        <Field label="Status">
          <select
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value as Employee["status"] })}
            className={inputCls}
          >
            <option>Active</option>
            <option>On Leave</option>
            <option>Inactive</option>
          </select>
        </Field>
        <Field label="Phone" error={errors.phone}>
          <input
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            className={inputCls}
            placeholder="+91 98100 00000"
          />
        </Field>
        <Field label="Reports To / Manager">
          <select
            value={form.managerId}
            onChange={(e) => setForm({ ...form, managerId: e.target.value })}
            className={inputCls}
          >
            <option value="">— No Manager (Direct Report) —</option>
            {managers
              .filter((m) => m.id !== editing?.id) // Prevent self-reporting
              .map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.id})
                </option>
              ))}
          </select>
        </Field>
        <Field label="Address" className="md:col-span-2" error={errors.address}>
          <input
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            className={inputCls}
            placeholder="City, State"
          />
        </Field>
      </div>

      {/* System Access Card */}
      <div className="mt-5 border-t border-border pt-4">
        <div className="mb-3 text-xs font-bold uppercase tracking-wide text-indigo-600 dark:text-indigo-400">
          System Access Configuration
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 bg-indigo-50/20 dark:bg-indigo-950/10 border border-indigo-100 dark:border-indigo-950 p-4 rounded-2xl">
          <label className="flex items-center gap-2.5 cursor-pointer md:col-span-2 select-none py-1">
            <input
              type="checkbox"
              checked={form.createAccount}
              onChange={(e) => setForm({ ...form, createAccount: e.target.checked })}
              className="h-4 w-4 rounded border-border text-indigo-600 focus:ring-indigo-500/20 accent-indigo-600"
            />
            <span className="text-xs font-semibold text-foreground">
              Create / Enable User Login Account
            </span>
          </label>

          {form.createAccount && (
            <Field
              label="Assigned System Access Role *"
              className="md:col-span-2"
              error={errors.roleId || (rolesError ? `Unable to load roles: ${rolesError}` : undefined)}
            >
              <select
                value={form.roleId}
                onChange={(e) => setForm({ ...form, roleId: e.target.value })}
                disabled={rolesLoading}
                className={`${inputCls} border-indigo-200 dark:border-indigo-900 focus:border-indigo-500 disabled:opacity-60`}
              >
                <option value="">
                  {rolesLoading
                    ? "— Loading Access Roles... —"
                    : dbRoles.length === 0
                    ? "— No Assignable Roles Found —"
                    : "— Select Access Role —"}
                </option>
                {dbRoles
                  .filter((r) => r.name !== "SuperAdmin")
                  .map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
              </select>
            </Field>
          )}
        </div>
      </div>

      <div className="mt-5 border-t border-border pt-4">
        <div className="mb-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">
          Statutory & Compliance IDs (Optional)
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="UAN (PF)" error={errors.uan}>
            <input
              value={form.uan}
              onChange={(e) => setForm({ ...form, uan: e.target.value })}
              className={inputCls}
              placeholder="12-digit UAN"
            />
          </Field>
          <Field label="ESIC Number">
            <input
              value={form.esic}
              onChange={(e) => setForm({ ...form, esic: e.target.value })}
              className={inputCls}
              placeholder="10-digit ESIC"
            />
          </Field>
          <Field label="PAN" error={errors.pan}>
            <input
              value={form.pan}
              onChange={(e) => setForm({ ...form, pan: e.target.value })}
              className={inputCls}
              placeholder="AAAAA0000A"
            />
          </Field>
          <Field label="Aadhaar" error={errors.aadhaar}>
            <input
              value={form.aadhaar}
              onChange={(e) => setForm({ ...form, aadhaar: e.target.value })}
              className={inputCls}
              placeholder="XXXX XXXX XXXX"
            />
          </Field>
        </div>
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <Btn variant="outline" onClick={onClose} disabled={loading}>
          Cancel
        </Btn>
        <Btn onClick={submit} disabled={loading}>
          {loading ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          ) : (
            <Check className="h-4 w-4" />
          )}
          <span>
            {editing
              ? loading
                ? "Updating..."
                : "Update Employee"
              : loading
                ? "Saving..."
                : "Save Employee"}
          </span>
        </Btn>
      </div>
    </ModalShell>
  );
}

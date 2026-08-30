import React, { useState } from "react";
import { CalendarPlus } from "lucide-react";
import { ModalShell, Field, Btn, inputCls, dateInputProps } from "../../../components/ui";
import type { Employee, LeaveRequest, LeaveType, AuthUser } from "../../../types";

interface ApplyLeaveModalProps {
  onClose: () => void;
  onSubmit: (l: Omit<LeaveRequest, "id" | "status">) => Promise<void>;
  employees: Employee[];
  leaveTypes: LeaveType[];
  currentUser: AuthUser;
}

export function ApplyLeaveModal({
  onClose,
  onSubmit,
  employees,
  leaveTypes,
  currentUser,
}: ApplyLeaveModalProps) {
  const defaultLeaveTypes: LeaveType[] = [
    { name: "Casual Leave", days: 12, tone: "indigo" },
    { name: "Sick Leave", days: 10, tone: "rose" },
    { name: "Annual Leave", days: 15, tone: "green" },
  ];
  const effectiveLeaveTypes = leaveTypes && leaveTypes.length > 0 ? leaveTypes : defaultLeaveTypes;

  const selectableEmployees =
    currentUser.role === "SuperAdmin"
      ? employees
      : employees.filter(
          (e) =>
            e.name !== currentUser.name &&
            e.email !== "hr@demo.co" &&
            !e.name.includes("Priya Menon"),
        );
  const defaultEmp =
    currentUser.role === "Employee" ? currentUser.name : selectableEmployees[0]?.name || "";
  const [f, setF] = useState({
    employee: defaultEmp,
    type: effectiveLeaveTypes[0]?.name || "Casual Leave",
    from: "",
    to: "",
    days: 1,
    reason: "",
    department: currentUser.department || "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    const errs: Record<string, string> = {};
    if (!f.from || !/^\d{4}-\d{2}-\d{2}$/.test(f.from)) {
      errs.from = "Invalid date format";
    }
    if (!f.to || !/^\d{4}-\d{2}-\d{2}$/.test(f.to)) {
      errs.to = "Invalid date format";
    } else if (f.from && new Date(f.to) < new Date(f.from)) {
      errs.to = "To Date cannot be earlier than From Date";
    }

    if (!f.reason.trim()) {
      errs.reason = "Required";
    } else if (f.reason.length > 500) {
      errs.reason = "Reason must not exceed 500 characters";
    } else if (/^\d+$/.test(f.reason.trim())) {
      errs.reason = "Reason must be descriptive, not just numbers";
    } else if (/^[!@#\$%\^&\*\(\)\_\+\-\=\[\]\{\};':",\./<>\?\\\s\|~`]+$/.test(f.reason.trim())) {
      errs.reason = "Reason must contain actual text description, not just symbols";
    }

    setErrors(errs);
    if (Object.keys(errs).length) return;

    setLoading(true);
    try {
      const emp = employees.find((e) => e.name === f.employee);
      await onSubmit({ ...f, department: emp?.department || f.department });
      onClose();
    } catch {
      // Keep open on error
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalShell title="Apply for Leave" onClose={onClose}>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label="Employee" className="md:col-span-2">
          {currentUser.role === "Employee" ? (
            <input
              value={f.employee}
              readOnly
              className={inputCls + " opacity-60 cursor-not-allowed"}
            />
          ) : (
            <select
              value={f.employee}
              onChange={(e) => setF({ ...f, employee: e.target.value })}
              className={inputCls}
            >
              {selectableEmployees.map((e) => (
                <option key={e.id}>{e.name}</option>
              ))}
            </select>
          )}
        </Field>
        <Field label="Leave Type">
          <select
            value={f.type}
            onChange={(e) => setF({ ...f, type: e.target.value })}
            className={inputCls}
          >
            {effectiveLeaveTypes.map((t) => (
              <option key={t.name}>{t.name}</option>
            ))}
          </select>
        </Field>
        <Field label="Days">
          <input
            type="number"
            min={1}
            value={f.days}
            onChange={(e) => setF({ ...f, days: Number(e.target.value) })}
            className={inputCls}
          />
        </Field>
        <Field label="From *" error={errors.from}>
          <input {...dateInputProps(f.from, (v) => setF({ ...f, from: v }))} className={inputCls} />
        </Field>
        <Field label="To *" error={errors.to}>
          <input {...dateInputProps(f.to, (v) => setF({ ...f, to: v }))} className={inputCls} />
        </Field>
        <Field label="Reason *" className="md:col-span-2" error={errors.reason}>
          <textarea
            value={f.reason}
            onChange={(e) => setF({ ...f, reason: e.target.value })}
            placeholder="Brief reason"
            className={inputCls + " min-h-[80px] py-2"}
          />
        </Field>
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <Btn variant="outline" onClick={onClose} disabled={loading}>
          Cancel
        </Btn>
        <Btn onClick={submit} disabled={loading}>
          {loading ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          ) : (
            <CalendarPlus className="h-4 w-4" />
          )}
          <span>{loading ? "Submitting..." : "Submit Request"}</span>
        </Btn>
      </div>
    </ModalShell>
  );
}

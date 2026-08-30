import React from "react";
import { X, Edit3, Mail } from "lucide-react";
import { Avatar, Badge, Row, Btn } from "../../../components/ui";
import type { Employee } from "../../../types";
import { useEmployeesQuery } from "../../../hooks/useEmployeesQuery";

interface ViewEmployeeDrawerProps {
  emp: Employee;
  onClose: () => void;
  onEdit: () => void;
  onMessage: () => void;
  isPage?: boolean;
  canEdit?: boolean;
}

export function ViewEmployeeDrawer({
  emp,
  onClose,
  onEdit,
  onMessage,
  isPage,
  canEdit = true,
}: ViewEmployeeDrawerProps) {
  const { data: employeesData, employees: employeesProp } = useEmployeesQuery();
  const employees: Employee[] = Array.isArray(employeesProp) && employeesProp.length > 0
    ? employeesProp
    : (Array.isArray(employeesData)
        ? employeesData
        : (employeesData && Array.isArray((employeesData as any).data)
            ? (employeesData as any).data
            : (Array.isArray(employeesProp) ? employeesProp : [])));
  const managerName = emp.managerId
    ? employees.find((e) => e.id === emp.managerId)?.name || emp.managerId
    : "—";

  const innerContent = (
    <div className="p-6">
      <div className="flex items-center gap-4">
        <Avatar src={emp.avatar} name={emp.name} size={64} />
        <div className="min-w-0">
          <div className="text-xl font-bold truncate">{emp.name}</div>
          <div className="text-sm text-muted-foreground">
            {emp.designation} · {emp.department}
          </div>
          <div className="mt-1 flex items-center gap-2">
            <Badge
              tone={
                emp.status === "Active" ? "green" : emp.status === "On Leave" ? "amber" : "slate"
              }
            >
              {emp.status}
            </Badge>
            <span className="text-xs font-mono font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
              {emp.id}
            </span>
          </div>
        </div>
      </div>
      <div className="mt-5 space-y-2 rounded-xl border border-border p-4">
        <div className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-3">
          Personal Information
        </div>
        <Row k="Employee ID" v={emp.id} />
        <Row k="Email" v={emp.email} />
        <Row k="Phone" v={emp.phone || "–"} />
        <Row k="Date of Birth" v={emp.dob || "–"} />
        <Row k="Gender" v={emp.gender || "–"} />
        <Row k="Address" v={emp.address || "–"} />
      </div>
      <div className="mt-4 space-y-2 rounded-xl border border-border p-4">
        <div className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-3">
          Employment Details
        </div>
        <Row k="Joined" v={emp.joined} />
        {emp.salary !== null && emp.salary !== undefined && (
          <Row k="Monthly Salary" v={`₹${Number(emp.salary).toLocaleString("en-IN")}`} bold />
        )}
        <Row k="Reporting Manager" v={managerName} />
      </div>
      {(emp.uan || emp.esic || emp.pan || emp.aadhaar) && (
        <div className="mt-4 space-y-2 rounded-xl border border-border p-4">
          <div className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-3">
            Statutory IDs
          </div>
          {emp.uan && <Row k="UAN (PF)" v={emp.uan} />}
          {emp.esic && <Row k="ESIC No." v={emp.esic} />}
          {emp.pan && <Row k="PAN" v={emp.pan} />}
          {emp.aadhaar && <Row k="Aadhaar" v={emp.aadhaar} />}
        </div>
      )}
      <div className="mt-6 grid grid-cols-2 gap-2">
        {canEdit && (
          <Btn variant="outline" onClick={onEdit}>
            <Edit3 className="h-4 w-4" /> Edit
          </Btn>
        )}
        <Btn onClick={onMessage} className={!canEdit ? "col-span-2" : ""}>
          <Mail className="h-4 w-4" /> Message
        </Btn>
      </div>
    </div>
  );

  if (isPage) {
    return (
      <div className="mx-auto max-w-3xl rounded-2xl border border-border bg-card shadow-[var(--shadow-soft)] animate-in fade-in duration-200">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="text-xl font-bold">Employee Profile</div>
          <button
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {innerContent}
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex justify-end bg-slate-950/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="h-full w-full max-w-md border-l border-border bg-card shadow-2xl animate-in slide-in-from-right duration-300 overflow-y-auto"
      >
        <div className="flex items-center justify-between border-b border-border px-6 py-4 sticky top-0 bg-card z-10">
          <div className="text-lg font-bold">Employee Details</div>
          <button
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {innerContent}
      </div>
    </div>
  );
}

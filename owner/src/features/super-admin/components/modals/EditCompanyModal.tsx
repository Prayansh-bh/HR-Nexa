import React from "react";
import { XCircle } from "lucide-react";
import { SaaSCompany } from "../../types/superAdmin.types";

const inputCls =
  "h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20";

function Btn({
  children,
  onClick,
  variant = "primary",
  type = "button",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "outline";
  type?: "button" | "submit";
}) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition duration-200 px-4 py-2 text-sm";
  const variants = {
    primary: "btn-gradient hover:brightness-110 text-white",
    outline: "border border-border bg-card hover:border-primary hover:text-primary text-foreground",
  };
  return (
    <button type={type} onClick={onClick} className={`${base} ${variants[variant]}`}>
      {children}
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
        {label}
      </label>
      {children}
    </div>
  );
}

function LocalModalShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/60 p-3 sm:p-4 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg max-h-[90vh] flex flex-col rounded-2xl border border-border bg-card shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden"
      >
        <div className="flex items-center justify-between border-b border-border px-5 sm:px-6 py-4 shrink-0">
          <div className="text-base sm:text-lg font-bold">{title}</div>
          <button
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted transition"
          >
            <XCircle className="h-4 w-4" />
          </button>
        </div>
        <div className="p-4 sm:p-6 overflow-y-auto flex-1">{children}</div>
      </div>
    </div>
  );
}

interface EditCompanyModalProps {
  editingCompany: SaaSCompany | null;
  setEditingCompany: React.Dispatch<React.SetStateAction<SaaSCompany | null>>;
  onSubmit: (e: React.FormEvent) => void;
}

export const EditCompanyModal: React.FC<EditCompanyModalProps> = ({
  editingCompany,
  setEditingCompany,
  onSubmit,
}) => {
  if (!editingCompany) return null;

  return (
    <LocalModalShell
      title={`Edit Tenant: ${editingCompany.name}`}
      onClose={() => setEditingCompany(null)}
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <Field label="Company Name">
          <input
            type="text"
            value={editingCompany.name}
            onChange={(e) => setEditingCompany({ ...editingCompany, name: e.target.value })}
            className={inputCls}
            required
          />
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          <Field label="Subscription Plan">
            <select
              value={editingCompany.plan}
              onChange={(e) =>
                setEditingCompany({ ...editingCompany, plan: e.target.value as any })
              }
              className={inputCls}
            >
              <option value="Basic">Basic Plan</option>
              <option value="Standard">Standard Plan</option>
              <option value="Premium">Premium Plan</option>
            </select>
          </Field>
          <Field label="Account Status">
            <select
              value={editingCompany.status}
              onChange={(e) =>
                setEditingCompany({ ...editingCompany, status: e.target.value as any })
              }
              className={inputCls}
            >
              <option value="Active">Active</option>
              <option value="Trial">Trial</option>
              <option value="Expired">Expired</option>
              <option value="Suspended">Suspended</option>
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          <Field label="Purchased Seat Limit">
            <input
              type="number"
              value={editingCompany.purchasedSeats}
              onChange={(e) =>
                setEditingCompany({ ...editingCompany, purchasedSeats: Number(e.target.value) })
              }
              className={inputCls}
            />
          </Field>
          <Field label="Used Seats (Employees)">
            <input
              type="number"
              value={editingCompany.employeesCount}
              onChange={(e) =>
                setEditingCompany({ ...editingCompany, employeesCount: Number(e.target.value) })
              }
              className={inputCls}
            />
          </Field>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          <Field label="HR Admin Name">
            <input
              type="text"
              value={editingCompany.ownerName}
              onChange={(e) => setEditingCompany({ ...editingCompany, ownerName: e.target.value })}
              className={inputCls}
            />
          </Field>
          <Field label="HR Admin Email">
            <input
              type="email"
              value={editingCompany.ownerEmail}
              onChange={(e) => setEditingCompany({ ...editingCompany, ownerEmail: e.target.value })}
              className={inputCls}
            />
          </Field>
        </div>
        <div className="flex justify-end gap-2 pt-4">
          <Btn onClick={() => setEditingCompany(null)} variant="outline">
            Cancel
          </Btn>
          <Btn type="submit" variant="primary">
            Save Changes
          </Btn>
        </div>
      </form>
    </LocalModalShell>
  );
};

import React from "react";
import { XCircle } from "lucide-react";
import { useSystemSettingsQuery } from "../../../../hooks/useSystemSettingsQuery";

const inputCls =
  "h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20";

function Btn({
  children,
  onClick,
  variant = "primary",
  type = "button",
  disabled,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "outline";
  type?: "button" | "submit";
  disabled?: boolean;
}) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition duration-200 px-4 py-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed";
  const variants = {
    primary: "btn-gradient hover:brightness-110 text-white",
    outline: "border border-border bg-card hover:border-primary hover:text-primary text-foreground",
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${variants[variant]}`}
    >
      {children}
    </button>
  );
}

function Field({
  label,
  children,
  error,
}: {
  label: string;
  children: React.ReactNode;
  error?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
        {label}
      </label>
      {children}
      {error && <span className="text-xs text-destructive font-semibold">{error}</span>}
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
  React.useEffect(() => {
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [onClose]);
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

interface OnboardCompanyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  newCompany: {
    name: string;
    plan: "Basic" | "Standard" | "Premium";
    employeesCount: number;
    status: "Active" | "Trial" | "Expired" | "Suspended";
    ownerName: string;
    ownerEmail: string;
    purchasedSeats: number;
  };
  setNewCompany: React.Dispatch<
    React.SetStateAction<{
      name: string;
      plan: "Basic" | "Standard" | "Premium";
      employeesCount: number;
      status: "Active" | "Trial" | "Expired" | "Suspended";
      ownerName: string;
      ownerEmail: string;
      purchasedSeats: number;
    }>
  >;
}

export const OnboardCompanyModal: React.FC<OnboardCompanyModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  newCompany,
  setNewCompany,
}) => {
  const { data: systemSettings } = useSystemSettingsQuery();
  const trialDays = systemSettings?.trialDays ?? 14;

  if (!isOpen) return null;

  const isHeadcountExceeded = newCompany.employeesCount > newCompany.purchasedSeats;

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isHeadcountExceeded) return;
    onSubmit(e);
  };

  return (
    <LocalModalShell title="Onboard New Tenant Company" onClose={onClose}>
      <form onSubmit={handleFormSubmit} className="space-y-4">
        <Field label="Company Name">
          <input
            type="text"
            value={newCompany.name}
            onChange={(e) => setNewCompany({ ...newCompany, name: e.target.value })}
            className={inputCls}
            placeholder="e.g. Acme Corporation Pvt Ltd"
            required
          />
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          <Field label="Subscription Plan">
            <select
              value={newCompany.plan}
              onChange={(e) => setNewCompany({ ...newCompany, plan: e.target.value as any })}
              className={inputCls}
            >
              <option value="Basic">Basic Plan (₹15,000/mo)</option>
              <option value="Standard">Standard Plan (₹42,000/mo)</option>
              <option value="Premium">Premium Plan (₹85,000/mo)</option>
            </select>
          </Field>
          <Field label="Account Status">
            <select
              value={newCompany.status}
              onChange={(e) => setNewCompany({ ...newCompany, status: e.target.value as any })}
              className={inputCls}
            >
              <option value="Active">Active</option>
              <option value="Trial">{`Trial (${trialDays} Days)`}</option>
              <option value="Expired">Expired</option>
              <option value="Suspended">Suspended</option>
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          <Field label="HR Admin Full Name">
            <input
              type="text"
              value={newCompany.ownerName}
              onChange={(e) => setNewCompany({ ...newCompany, ownerName: e.target.value })}
              className={inputCls}
              placeholder="e.g. Vikram Malhotra"
              required
            />
          </Field>
          <Field label="HR Admin Work Email">
            <input
              type="email"
              value={newCompany.ownerEmail}
              onChange={(e) => setNewCompany({ ...newCompany, ownerEmail: e.target.value })}
              className={inputCls}
              placeholder="admin@acme.com"
              required
            />
          </Field>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          <Field label="Purchased Seat Limit">
            <input
              type="number"
              value={newCompany.purchasedSeats}
              onChange={(e) =>
                setNewCompany({ ...newCompany, purchasedSeats: Number(e.target.value) })
              }
              className={inputCls}
              min={1}
              required
            />
          </Field>
          <Field
            label="Initial Headcount"
            error={
              isHeadcountExceeded
                ? "Initial Headcount cannot exceed Purchased Seat Limit"
                : undefined
            }
          >
            <input
              type="number"
              value={newCompany.employeesCount}
              onChange={(e) =>
                setNewCompany({ ...newCompany, employeesCount: Number(e.target.value) })
              }
              className={`${inputCls} ${isHeadcountExceeded ? "border-destructive focus:ring-destructive/20" : ""}`}
              min={1}
              required
            />
          </Field>
        </div>
        <div className="flex justify-end gap-2 pt-4">
          <Btn onClick={onClose} variant="outline">
            Cancel
          </Btn>
          <Btn type="submit" variant="primary" disabled={isHeadcountExceeded}>
            Create Tenant
          </Btn>
        </div>
      </form>
    </LocalModalShell>
  );
};

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

interface GenerateInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  companies: SaaSCompany[];
  newInvoice: { companyName: string; amount: number; status: "Paid" | "Pending" | "Overdue" };
  setNewInvoice: React.Dispatch<
    React.SetStateAction<{
      companyName: string;
      amount: number;
      status: "Paid" | "Pending" | "Overdue";
    }>
  >;
  onSubmit: (e: React.FormEvent) => void;
}

export const GenerateInvoiceModal: React.FC<GenerateInvoiceModalProps> = ({
  isOpen,
  onClose,
  companies,
  newInvoice,
  setNewInvoice,
  onSubmit,
}) => {
  if (!isOpen) return null;

  return (
    <LocalModalShell title="Generate Platform Invoice" onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-4">
        <Field label="Target Company">
          <select
            value={newInvoice.companyName}
            onChange={(e) => setNewInvoice({ ...newInvoice, companyName: e.target.value })}
            className={inputCls}
            required
          >
            <option value="">Select Company...</option>
            {companies.map((c) => (
              <option key={c.id} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          <Field label="Invoice Amount (₹)">
            <input
              type="number"
              value={newInvoice.amount}
              onChange={(e) => setNewInvoice({ ...newInvoice, amount: Number(e.target.value) })}
              className={inputCls}
              required
            />
          </Field>
          <Field label="Initial Status">
            <select
              value={newInvoice.status}
              onChange={(e) => setNewInvoice({ ...newInvoice, status: e.target.value as any })}
              className={inputCls}
            >
              <option value="Paid">Paid</option>
              <option value="Pending">Pending</option>
              <option value="Overdue">Overdue</option>
            </select>
          </Field>
        </div>
        <div className="flex justify-end gap-2 pt-4">
          <Btn onClick={onClose} variant="outline">
            Cancel
          </Btn>
          <Btn type="submit" variant="primary">
            Generate Invoice
          </Btn>
        </div>
      </form>
    </LocalModalShell>
  );
};

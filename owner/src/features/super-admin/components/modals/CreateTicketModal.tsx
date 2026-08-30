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

interface CreateTicketModalProps {
  isOpen: boolean;
  onClose: () => void;
  companies: SaaSCompany[];
  newTicket: {
    companyName: string;
    subject: string;
    priority: "Low" | "Medium" | "High" | "Critical";
  };
  setNewTicket: React.Dispatch<
    React.SetStateAction<{
      companyName: string;
      subject: string;
      priority: "Low" | "Medium" | "High" | "Critical";
    }>
  >;
  onSubmit: (e: React.FormEvent) => void;
}

export const CreateTicketModal: React.FC<CreateTicketModalProps> = ({
  isOpen,
  onClose,
  companies,
  newTicket,
  setNewTicket,
  onSubmit,
}) => {
  if (!isOpen) return null;

  return (
    <LocalModalShell title="Open Platform Support Ticket" onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-4">
        <Field label="Target Tenant Company">
          <select
            value={newTicket.companyName}
            onChange={(e) => setNewTicket({ ...newTicket, companyName: e.target.value })}
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
        <Field label="Ticket Title / Subject">
          <input
            type="text"
            value={newTicket.subject}
            onChange={(e) => setNewTicket({ ...newTicket, subject: e.target.value })}
            className={inputCls}
            placeholder="e.g. Employee import failing from CSV"
            required
          />
        </Field>
        <Field label="Priority Level">
          <select
            value={newTicket.priority}
            onChange={(e) => setNewTicket({ ...newTicket, priority: e.target.value as any })}
            className={inputCls}
          >
            <option value="Low">Low</option>
            <option value="Medium">Medium</option>
            <option value="High">High</option>
            <option value="Critical">Critical</option>
          </select>
        </Field>
        <div className="flex justify-end gap-2 pt-4">
          <Btn onClick={onClose} variant="outline">
            Cancel
          </Btn>
          <Btn type="submit" variant="primary">
            Open Ticket
          </Btn>
        </div>
      </form>
    </LocalModalShell>
  );
};

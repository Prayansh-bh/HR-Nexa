import React, { useState, useEffect } from "react";
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

interface CreateSubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  companies: SaaSCompany[];
  plans?: any[];
  onAssign: (data: { companyId: string; plan: string; seatCount: number }) => void;
}

export const CreateSubscriptionModal: React.FC<CreateSubscriptionModalProps> = ({
  isOpen,
  onClose,
  companies,
  plans = [],
  onAssign,
}) => {
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [selectedPlan, setSelectedPlan] = useState("");
  const [seatCount, setSeatCount] = useState(50);

  // Default fallback plans if plans list from query is empty
  const activePlans =
    plans.length > 0
      ? plans
      : [
          { id: "p1", name: "Basic", price: 15000, employeeLimit: 15 },
          { id: "p2", name: "Standard", price: 42000, employeeLimit: 50 },
          { id: "p3", name: "Premium", price: 85000, employeeLimit: 250 },
        ];

  // Set initial default plan when modal opens
  useEffect(() => {
    if (isOpen && activePlans.length > 0 && !selectedPlan) {
      const defaultPlan = activePlans[0];
      setSelectedPlan(defaultPlan.name);
      setSeatCount(defaultPlan.employeeLimit || defaultPlan.maxUsers || defaultPlan.seats || 50);
    }
  }, [isOpen, activePlans, selectedPlan]);

  if (!isOpen) return null;

  const handlePlanChange = (planName: string) => {
    setSelectedPlan(planName);
    const matched = activePlans.find(
      (p) =>
        p.name.toLowerCase() === planName.toLowerCase() ||
        p.code?.toLowerCase() === planName.toLowerCase(),
    );
    if (matched) {
      const seats = matched.employeeLimit ?? matched.maxUsers ?? matched.seats ?? 50;
      setSeatCount(seats);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCompanyId || !selectedPlan) return;
    onAssign({ companyId: selectedCompanyId, plan: selectedPlan, seatCount });
  };

  return (
    <LocalModalShell title="Create Subscription Assignment" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Target Company">
          <select
            value={selectedCompanyId}
            onChange={(e) => setSelectedCompanyId(e.target.value)}
            className={inputCls}
            required
          >
            <option value="">Select Tenant Company...</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Assign Plan Tier">
          <select
            value={selectedPlan}
            onChange={(e) => handlePlanChange(e.target.value)}
            className={inputCls}
            required
          >
            <option value="">Select Published Plan...</option>
            {activePlans.map((p) => {
              const price = p.monthlyPrice ?? p.price ?? 0;
              const yearly = p.yearlyPrice ?? (typeof price === 'number' ? price * 12 : 0);
              const limit = p.employeeLimit ?? p.maxUsers ?? p.seats ?? 50;
              return (
                <option key={p.id || p.name} value={p.name}>
                  {p.name} (₹{Number(price).toLocaleString()}/mo | ₹{Number(yearly).toLocaleString()}/yr — {limit} seats)
                </option>
              );
            })}
          </select>
        </Field>
        <Field label="Seat Allowance">
          <input
            type="number"
            value={seatCount}
            onChange={(e) => setSeatCount(Number(e.target.value))}
            className={inputCls}
            min={1}
            required
          />
        </Field>
        <div className="flex justify-end gap-2 pt-4">
          <Btn onClick={onClose} variant="outline">
            Cancel
          </Btn>
          <Btn type="submit" variant="primary">
            Assign Plan
          </Btn>
        </div>
      </form>
    </LocalModalShell>
  );
};

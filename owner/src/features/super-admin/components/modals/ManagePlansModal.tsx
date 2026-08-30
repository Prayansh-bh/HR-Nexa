import React, { useEffect } from "react";
import { XCircle } from "lucide-react";

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

export interface PlanUpdatePayload {
  name: string;
  price: number;
  yearlyPrice?: number;
  employeeLimit: number;
}

interface ManagePlansModalProps {
  isOpen: boolean;
  onClose: () => void;
  plans?: any[];
  newPlan: PlanUpdatePayload;
  setNewPlan: React.Dispatch<React.SetStateAction<PlanUpdatePayload>>;
  onSubmit: (e: React.FormEvent) => void;
}

export const ManagePlansModal: React.FC<ManagePlansModalProps> = ({
  isOpen,
  onClose,
  plans = [],
  newPlan,
  setNewPlan,
  onSubmit,
}) => {
  if (!isOpen) return null;

  const planOptions =
    plans.length > 0
      ? plans
      : [
          { name: "Basic", monthlyPrice: 2999, yearlyPrice: 29990, employeeLimit: 15 },
          { name: "Standard", monthlyPrice: 7999, yearlyPrice: 79990, employeeLimit: 50 },
          { name: "Premium", monthlyPrice: 14999, yearlyPrice: 149990, employeeLimit: 250 },
        ];

  const handlePlanChange = (selectedName: string) => {
    const found = planOptions.find(
      (p) =>
        p.name === selectedName || (p.name && p.name.toLowerCase() === selectedName.toLowerCase()),
    );
    if (found) {
      const priceVal =
        typeof found.monthlyPrice === "number"
          ? found.monthlyPrice
          : Number(String(found.price || 0).replace(/[^0-9.]/g, "")) || 0;
      const yearlyVal =
        typeof found.yearlyPrice === "number"
          ? found.yearlyPrice
          : priceVal * 12;

      setNewPlan({
        name: found.name,
        price: priceVal,
        yearlyPrice: yearlyVal,
        employeeLimit: found.employeeLimit || 15,
      });
    } else {
      setNewPlan((prev) => ({ ...prev, name: selectedName }));
    }
  };

  return (
    <LocalModalShell title="Manage SaaS Pricing Plans" onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-4">
        <Field label="Select Plan Tier">
          <select
            value={newPlan.name}
            onChange={(e) => handlePlanChange(e.target.value)}
            className={inputCls}
          >
            {planOptions.map((p) => (
              <option key={p.id || p.name} value={p.name}>
                {p.name} Plan
              </option>
            ))}
          </select>
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          <Field label="Monthly Pricing (₹)">
            <input
              type="number"
              value={newPlan.price}
              onChange={(e) => setNewPlan({ ...newPlan, price: Number(e.target.value) })}
              className={inputCls}
              required
              min={0}
            />
          </Field>
          <Field label="Annual Pricing (₹)">
            <input
              type="number"
              value={newPlan.yearlyPrice ?? newPlan.price * 12}
              onChange={(e) => setNewPlan({ ...newPlan, yearlyPrice: Number(e.target.value) })}
              className={inputCls}
              required
              min={0}
            />
          </Field>
        </div>
        <Field label="Headcount Limit (Seats)">
          <input
            type="number"
            value={newPlan.employeeLimit}
            onChange={(e) => setNewPlan({ ...newPlan, employeeLimit: Number(e.target.value) })}
            className={inputCls}
            required
            min={1}
          />
        </Field>
        <div className="flex justify-end gap-2 pt-4">
          <Btn onClick={onClose} variant="outline">
            Cancel
          </Btn>
          <Btn type="submit" variant="primary">
            Update Pricing
          </Btn>
        </div>
      </form>
    </LocalModalShell>
  );
};

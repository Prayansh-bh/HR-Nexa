import React, { useState, useEffect } from "react";
import { settingsService } from "../../../services/settings.service";
import { PageHeader, ReadOnlyBanner } from "../../../components/ui";

const inputCls =
  "h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20";
const cardCls =
  "rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)] transition hover:shadow-[var(--shadow-elevated)]";

function Field({
  label,
  children,
  className = "",
  error,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
  error?: string;
}) {
  return (
    <div className={className}>
      <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">{label}</label>
      {children}
      {error && <div className="mt-1 text-xs text-destructive">{error}</div>}
    </div>
  );
}

function Btn({
  children,
  onClick,
  variant = "primary",
  size = "md",
  className = "",
  type = "button",
  disabled,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "ghost" | "outline" | "danger" | "success";
  size?: "sm" | "md";
  className?: string;
  type?: "button" | "submit";
  disabled?: boolean;
}) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition duration-200 hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0";
  const sizes = { sm: "px-3 py-1.5 text-xs", md: "px-4 py-2 text-sm" };
  const variants = {
    primary: "btn-gradient hover:brightness-110",
    success: "bg-[color:var(--color-success)] text-white shadow-md hover:brightness-110",
    ghost: "text-muted-foreground hover:bg-muted hover:text-foreground",
    outline: "border border-border bg-card hover:border-primary hover:text-primary",
    danger: "bg-destructive text-destructive-foreground shadow-md hover:brightness-110",
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`${cardCls} ${className}`}>{children}</div>;
}

export function CompanyProfilePage({
  user,
  toast,
  canEditSettings,
}: {
  user: any;
  toast: any;
  canEditSettings: boolean;
}) {
  const [compSettings, setCompSettings] = useState<any>(null);
  const [form, setForm] = useState({
    name: (user as any)?.companyName || "Acme Corp",
    legal: "",
    email: "",
    phone: "",
    address: "",
  });

  useEffect(() => {
    settingsService
      .getCompanySettings()
      .then((data) => {
        setCompSettings(data);
        setForm({
          name: (user as any)?.companyName || "Acme Corp",
          legal: data.legalName || "",
          email: data.email || "",
          phone: data.phone || "",
          address: data.address || "",
        });
      })
      .catch(() => {});
  }, [user]);

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

  const handleReset = () => {
    if (compSettings) {
      setForm({
        name: (user as any)?.companyName || "Acme Corp",
        legal: compSettings.legalName || "",
        email: compSettings.email || "",
        phone: compSettings.phone || "",
        address: compSettings.address || "",
      });
    }
  };

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
          <Btn variant="outline" onClick={handleReset}>Reset</Btn>
          {canEditSettings && <Btn onClick={saveCompany}>Save Changes</Btn>}
        </div>
      </Card>
    </div>
  );
}

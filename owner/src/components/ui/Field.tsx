import type { ReactNode } from "react";

export function Field({
  label,
  children,
  className = "",
  error,
  id,
}: {
  label: string;
  children: ReactNode;
  className?: string;
  error?: string;
  id?: string;
}) {
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-xs font-semibold text-muted-foreground">
        {label}
      </label>
      {children}
      {error && <div className="mt-1 text-xs text-destructive">{error}</div>}
    </div>
  );
}

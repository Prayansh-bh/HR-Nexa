import type { ReactNode } from "react";

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3 sm:flex sm:flex-wrap sm:justify-between sm:gap-4">
      <div className="min-w-0">
        <h1 className="truncate text-xl font-bold tracking-tight md:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-xs md:text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {action && <div className="col-span-2 sm:col-span-1 flex flex-wrap gap-2">{action}</div>}
    </div>
  );
}

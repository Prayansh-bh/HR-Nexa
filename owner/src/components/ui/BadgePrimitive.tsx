import type { ReactNode } from "react";
import type { BadgeTone } from "../../types/auth";

export function Badge({
  children,
  tone = "slate",
  className = "",
}: {
  children: ReactNode;
  tone?: BadgeTone;
  className?: string;
}) {
  const tones: Record<string, string> = {
    slate: "bg-muted text-muted-foreground",
    green: "bg-[color:var(--color-success)]/15 text-[color:var(--color-success)]",
    amber: "bg-[color:var(--color-warning)]/15 text-[color:var(--color-warning)]",
    rose: "bg-destructive/15 text-destructive",
    indigo: "bg-primary/15 text-primary",
    sky: "bg-[color:var(--color-info)]/15 text-[color:var(--color-info)]",
    blue: "bg-blue-500/15 text-blue-500",
    emerald: "bg-emerald-500/15 text-emerald-500",
    purple: "bg-purple-500/15 text-purple-500",
    cyan: "bg-cyan-500/15 text-cyan-500",
    orange: "bg-orange-500/15 text-orange-500",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${tones[tone] || tones.slate} ${className}`}
    >
      {children}
    </span>
  );
}

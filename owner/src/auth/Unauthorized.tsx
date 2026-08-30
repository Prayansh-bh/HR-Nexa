import React from "react";
import { ShieldAlert, ArrowLeft, Lock } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";

export interface UnauthorizedProps {
  title?: string;
  message?: string;
  requiredPermission?: string;
}

/**
 * Standardized Enterprise 403 Access Denied Component
 */
export const Unauthorized: React.FC<UnauthorizedProps> = ({
  title = "Access Denied (403)",
  message = "You do not have permission to view or manage this feature.",
  requiredPermission,
}) => {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-[60vh] w-full items-center justify-center p-6">
      <div className="w-full max-w-md space-y-6 rounded-3xl border border-border bg-card p-8 text-center shadow-lg animate-in fade-in zoom-in-95 duration-300">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-destructive/10 text-destructive">
          <ShieldAlert className="h-8 w-8" />
        </div>

        <div className="space-y-2">
          <h2 className="text-xl font-bold tracking-tight text-foreground">{title}</h2>
          <p className="text-xs text-muted-foreground leading-relaxed">{message}</p>
        </div>

        {requiredPermission && (
          <div className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-[11px] font-mono font-semibold text-muted-foreground border border-border">
            <Lock className="h-3 w-3 text-destructive" />
            <span>Required: {requiredPermission}</span>
          </div>
        )}

        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => window.history.back()}
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-background px-4 py-2 text-xs font-semibold text-foreground transition hover:bg-muted/50"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Go Back</span>
          </button>
          <button
            type="button"
            onClick={() => navigate({ to: "/dashboard" })}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-white transition hover:brightness-110 shadow-sm"
          >
            <span>Dashboard</span>
          </button>
        </div>
      </div>
    </div>
  );
};

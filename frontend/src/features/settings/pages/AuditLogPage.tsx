import React, { useState, useEffect } from "react";
import { useAuditLogsStore } from "../../../store";

const cardCls =
  "rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)] transition hover:shadow-[var(--shadow-elevated)]";
const inputCls =
  "h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20";

function Badge({ children, tone = "slate" }: { children: React.ReactNode; tone?: string }) {
  const tones: Record<string, string> = {
    slate: "bg-muted text-muted-foreground",
    green: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
    rose: "bg-destructive/15 text-destructive",
    indigo: "bg-primary/15 text-primary",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${tones[tone] || tones.slate}`}
    >
      {children}
    </span>
  );
}

import { useAuditLogsQuery } from "../../../hooks/useAuditLogsQuery";

export const AuditLogPage: React.FC<any> = () => {
  const { data: auditLogsData, isLoading } = useAuditLogsQuery();
  const auditLogs = auditLogsData || [];
  const [filter, setFilter] = useState("");

  const filtered = auditLogs.filter((l) => {
    const actor = l.userName || "";
    const moduleName = l.action || "";
    const details = l.details || "";
    return (
      actor.toLowerCase().includes(filter.toLowerCase()) ||
      moduleName.toLowerCase().includes(filter.toLowerCase()) ||
      details.toLowerCase().includes(filter.toLowerCase())
    );
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">System Audit Log</h1>
        <p className="text-sm text-muted-foreground">
          Browse chronological database transactions, settings updates, and login audit trails.
        </p>
      </div>

      <div className={cardCls + " !p-0 overflow-hidden"}>
        <div className="p-4 border-b border-border">
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter logs by operator, action, or module..."
            className={inputCls}
          />
        </div>
        {isLoading && auditLogs.length === 0 ? (
          <div className="flex h-32 items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left text-xs uppercase text-muted-foreground">
                  <th className="px-6 py-4">Timestamp</th>
                  <th className="px-6 py-4">Actor</th>
                  <th className="px-6 py-4">Module / Action</th>
                  <th className="px-6 py-4">Action details</th>
                  <th className="px-6 py-4 text-right">Log Type</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((l) => (
                  <tr
                    key={l.id}
                    className="border-b border-border/60 hover:bg-muted/40 font-mono text-xs"
                  >
                    <td className="px-6 py-4 text-muted-foreground">
                      {new Date(l.timestamp).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 font-bold">{l.userName}</td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-0.5 rounded bg-muted font-sans text-[10px] font-semibold uppercase">
                        {l.action}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-foreground font-sans">{l.details}</td>
                    <td className="px-6 py-4 text-right">
                      <Badge
                        tone={
                          l.action.includes("ERROR") || l.action.includes("FAIL") ? "rose" : "green"
                        }
                      >
                        {l.action.includes("ERROR") || l.action.includes("FAIL")
                          ? "error"
                          : "success"}
                      </Badge>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-muted-foreground font-sans">
                      No matching audit logs found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

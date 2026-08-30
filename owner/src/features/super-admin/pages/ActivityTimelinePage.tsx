import React, { useState, useEffect } from "react";
import { Activity, AlertCircle, Loader2 } from "lucide-react";
import { notificationService, AuditLogItem } from "../../../services/notification.service";

const cardCls =
  "rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)] transition hover:shadow-[var(--shadow-elevated)]";

function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-6">
      <h1 className="text-xl font-bold tracking-tight md:text-3xl">{title}</h1>
      {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
    </div>
  );
}

export function ActivityTimelinePage() {
  const [events, setEvents] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setIsLoading(true);
    setError(null);
    notificationService
      .getAuditLogs({ page: 1, limit: 10 })
      .then((logs) => {
        const logList: AuditLogItem[] = Array.isArray(logs?.data)
          ? logs.data
          : Array.isArray(logs)
          ? (logs as any)
          : [];

        setEvents(
          logList.slice(0, 10).map((log: AuditLogItem) => {
            let parsedMeta: any = null;
            let detailsText = "";

            if (log.details) {
              if (typeof log.details === "object") {
                parsedMeta = log.details;
                detailsText = log.details.summary || log.details.details || "";
              } else if (typeof log.details === "string") {
                const trimmed = log.details.trim();
                if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
                  try {
                    const parsed = JSON.parse(log.details);
                    parsedMeta = parsed;
                    detailsText = parsed.summary || parsed.details || "";
                  } catch {
                    detailsText = log.details;
                  }
                } else {
                  detailsText = log.details;
                }
              } else {
                detailsText = String(log.details);
              }
            }

            const timestampVal = log.timestamp || log.createdAt || Date.now();
            return {
              time: new Date(timestampVal).toLocaleTimeString("en-US", {
                hour: "2-digit",
                minute: "2-digit",
              }),
              action: `${log.userName || "System"}: ${log.action}${detailsText ? ` - ${detailsText}` : ""}`,
              icon: Activity,
              tone: "text-primary bg-primary/10",
              meta: parsedMeta,
            };
          }),
        );
        setIsLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load activity timeline:", err);
        setEvents([]);
        setError(err?.message || "Failed to load recent timeline activity. Please try again later.");
        setIsLoading(false);
      });
  }, []);

  return (
    <div className="space-y-6 w-full max-w-4xl mx-auto min-w-0 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <PageHeader
        title="Activity Timeline"
        subtitle="Live feed of high-level audit events across the platform"
      />
      <div className={cardCls + " p-6"}>
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-10 gap-3 text-muted-foreground">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
            <p className="text-sm">Loading timeline activity...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-8 gap-2 text-destructive text-center">
            <AlertCircle className="w-6 h-6" />
            <p className="text-sm font-medium">{error}</p>
          </div>
        ) : events.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            No recent timeline activity logged.
          </p>
        ) : (
          <div className="space-y-8 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-border before:to-transparent">
            {events.map((e, i) => (
              <div
                key={i}
                className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active w-full min-w-0"
              >
                <div className="flex items-center justify-center w-10 h-10 rounded-full border border-background shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow-sm z-10 bg-card">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center ${e.tone}`}
                  >
                    <e.icon className="w-4 h-4" />
                  </div>
                </div>
                <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-xl border border-border bg-card shadow-sm min-w-0">
                  <div className="flex items-start justify-between gap-3 min-w-0 mb-1">
                    <span className="font-semibold text-xs text-foreground break-words [word-break:break-word] whitespace-normal flex-1 min-w-0">
                      {e.action}
                    </span>
                    <time className="font-mono text-[10px] text-muted-foreground shrink-0 mt-0.5">
                      {e.time}
                    </time>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

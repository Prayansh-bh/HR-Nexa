import React from "react";
import { Card } from "../../../components/ui";
import { useAnnouncementsQuery } from "../../../hooks/useDashboardQueries";
import { formatDateTime } from "../../../utils/date.utils";
import { AlertTriangle, Clock, MessageSquare, ShieldAlert, Sparkles } from "lucide-react";

function getCategoryBadge(rawType?: string) {
  const typeLower = (rawType || "Notice").toLowerCase();
  if (typeLower.includes("security")) {
    return {
      tone: "bg-destructive/15 text-destructive",
      label: "Security Advisory",
      icon: <ShieldAlert size={12} className="shrink-0" />,
    };
  }
  if (typeLower.includes("maintenance")) {
    return {
      tone: "bg-[color:var(--color-warning)]/15 text-[color:var(--color-warning)]",
      label: "Platform Maintenance",
      icon: <AlertTriangle size={12} className="shrink-0" />,
    };
  }
  if (typeLower.includes("release")) {
    return {
      tone: "bg-[color:var(--color-success)]/15 text-[color:var(--color-success)]",
      label: "Release Updates",
      icon: <Sparkles size={12} className="shrink-0" />,
    };
  }
  return {
    tone: "bg-[color:var(--color-info)]/15 text-[color:var(--color-info)]",
    label: rawType || "General Notice",
    icon: <MessageSquare size={12} className="shrink-0" />,
  };
}

export function EmployeeAnnouncementsPage() {
  const { data: broadcastsData } = useAnnouncementsQuery();
  const broadcasts = broadcastsData || [];
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Corporate Announcements</h1>
          <p className="text-sm text-muted-foreground">
            Stay up-to-date with the latest company news and updates.
          </p>
        </div>
      </div>
      <div className="space-y-4">
        {broadcasts.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            No announcements available.
          </div>
        ) : (
          broadcasts.map((b) => {
            const cat = getCategoryBadge(b.type);
            const isMaintenance =
              (b.type || "").toLowerCase().includes("maintenance") ||
              Boolean(b.scheduledFor || b.duration);

            return (
              <Card key={b.id} className="space-y-4">
                <div className="flex justify-between items-start flex-wrap gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${cat.tone}`}
                      >
                        {cat.icon}
                        <span>{cat.label}</span>
                      </span>
                      <h3 className="font-bold text-lg text-foreground">{b.t}</h3>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Broadcast by {b.author} | {b.date}
                    </p>
                  </div>
                </div>

                {/* Structured Maintenance Schedule Section */}
                {(b.scheduledFor || b.duration) && (
                  <div
                    className={`flex flex-wrap items-center gap-3 sm:gap-6 p-3.5 rounded-xl border ${
                      isMaintenance
                        ? "border-amber-500/30 bg-amber-500/10 text-amber-950 dark:text-amber-200"
                        : "border-border bg-muted/40 text-foreground"
                    }`}
                  >
                    {b.scheduledFor && (
                      <div className="flex items-center gap-2 text-xs font-medium">
                        <Clock
                          size={14}
                          className={isMaintenance ? "text-amber-500" : "text-primary"}
                        />
                        <span className="opacity-80">Scheduled Start:</span>
                        <span className="font-semibold font-mono">
                          {formatDateTime(b.scheduledFor)}
                        </span>
                      </div>
                    )}
                    {b.duration && (
                      <div className="flex items-center gap-2 text-xs font-medium">
                        <span className="opacity-80">Duration:</span>
                        <span className="font-semibold px-2 py-0.5 rounded-md bg-background/80 border border-border">
                          {b.duration}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{b.d}</p>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}

import React, { useState, useMemo } from "react";
import { AlertTriangle, ShieldAlert, Sparkles, X } from "lucide-react";
import { useAnnouncementsQuery } from "../../hooks/useDashboardQueries";
import { formatDateTime } from "../../utils/date.utils";

export const PlatformAlertBanner: React.FC = () => {
  const { data: announcementsData } = useAnnouncementsQuery();
  const [dismissedIds, setDismissedIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("hrms.dismissed_announcements");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const activeNotice = useMemo(() => {
    if (!Array.isArray(announcementsData) || announcementsData.length === 0) return null;

    // Find highest priority active broadcast that has not been dismissed by user
    return (
      announcementsData.find((a) => {
        const id = a.id || a.title || a.t;
        if (dismissedIds.includes(id)) return false;

        const type = (a.type || a.category || "").toLowerCase();
        return (
          type.includes("maintenance") || type.includes("security") || type.includes("release")
        );
      }) || null
    );
  }, [announcementsData, dismissedIds]);

  const handleDismiss = (id: string) => {
    const updated = [...dismissedIds, id];
    setDismissedIds(updated);
    try {
      localStorage.setItem("hrms.dismissed_announcements", JSON.stringify(updated));
    } catch (err) {
      console.error("Failed to save dismissed announcement", err);
    }
  };

  if (!activeNotice) return null;

  const noticeType = (activeNotice.type || activeNotice.category || "Maintenance").toLowerCase();
  const noticeId = activeNotice.id || activeNotice.title || activeNotice.t;
  const noticeTitle = activeNotice.title || activeNotice.t || "Important Announcement";
  const noticeContent = activeNotice.content || activeNotice.d || "";

  let themeCls = "bg-amber-500/15 border-amber-500/30 text-amber-950 dark:text-amber-200";
  let icon = (
    <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400 animate-pulse" />
  );
  let badgeTone = "Platform Maintenance";

  if (noticeType.includes("security")) {
    themeCls = "bg-rose-500/15 border-rose-500/30 text-rose-950 dark:text-rose-200";
    icon = (
      <ShieldAlert className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400 animate-pulse" />
    );
    badgeTone = "Security Advisory";
  } else if (noticeType.includes("release")) {
    themeCls = "bg-sky-500/15 border-sky-500/30 text-sky-950 dark:text-sky-200";
    icon = <Sparkles className="h-4 w-4 shrink-0 text-sky-600 dark:text-sky-400" />;
    badgeTone = "Release Update";
  }

  const formattedScheduled = activeNotice.scheduledFor
    ? formatDateTime(activeNotice.scheduledFor)
    : null;

  return (
    <div
      className={`w-full border-b px-4 py-2 text-xs flex items-center justify-between gap-3 shadow-xs animate-in slide-in-from-top duration-300 ${themeCls}`}
    >
      <div className="flex items-center gap-2.5 flex-1 min-w-0">
        {icon}
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <span className="font-extrabold uppercase tracking-wider px-2 py-0.5 rounded bg-background/80 text-[10px] shrink-0 border border-current/20 shadow-xs">
            {badgeTone}
          </span>
          <span className="font-bold truncate text-foreground">{noticeTitle}</span>
          {formattedScheduled && (
            <span className="opacity-90 font-mono text-[11px] shrink-0">
              • Scheduled: <strong className="font-semibold">{formattedScheduled}</strong>
            </span>
          )}
          {activeNotice.duration && (
            <span className="opacity-90 font-mono text-[11px] shrink-0">
              • Duration: <strong className="font-semibold">{activeNotice.duration}</strong>
            </span>
          )}
          {noticeContent && (
            <span className="opacity-80 hidden xl:inline truncate text-[11px]">
              — {noticeContent}
            </span>
          )}
        </div>
      </div>

      <button
        onClick={() => handleDismiss(noticeId)}
        className="inline-flex items-center gap-1 font-semibold text-xs opacity-80 hover:opacity-100 transition px-2 py-1 rounded hover:bg-background/40 shrink-0 border border-transparent hover:border-current/20 cursor-pointer"
        title="Dismiss Alert"
      >
        <span>Dismiss</span>
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
};

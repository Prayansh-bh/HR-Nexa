import { useState, useEffect } from "react";
import {
  Bell,
  CheckCircle,
  ShieldAlert,
  AlertTriangle,
  Info,
  ToggleLeft,
  ToggleRight,
  Check,
  Trash2,
  ExternalLink,
  X,
  RefreshCw,
  CheckCheck,
} from "lucide-react";
import { PageHeader, Card } from "../../../components/ui";
import type { AuthUser } from "../../../types";
import { notificationService, SystemNotification } from "../../../services/notification.service";
import { useToast } from "../../../hooks";

function formatAgo(timestamp?: string | Date): string {
  if (!timestamp) return "Just now";
  const diffMs = Date.now() - new Date(timestamp).getTime();
  const mins = Math.floor(diffMs / (1000 * 60));
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours > 1 ? "s" : ""} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days > 1 ? "s" : ""} ago`;
}

export function NotificationsPage({ user }: { user: AuthUser }) {
  const toast = useToast();
  const [tab, setTab] = useState<"all" | "unread" | "prefs">("all");
  const [notifications, setNotifications] = useState<SystemNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedNotif, setSelectedNotif] = useState<SystemNotification | null>(null);

  const [prefs, setPrefs] = useState({
    leaveRequests: user?.notificationPrefs?.leaveRequests ?? true,
    payrollReady: user?.notificationPrefs?.payrollReady ?? true,
    birthdayReminders: user?.notificationPrefs?.birthdayReminders ?? true,
    weeklyDigest: user?.notificationPrefs?.weeklyDigest ?? false,
    attendanceAlerts: user?.notificationPrefs?.attendanceAlerts ?? true,
    systemUpdates: user?.notificationPrefs?.systemUpdates ?? true,
  });

  const handleTogglePref = async (key: string) => {
    const newPrefs = { ...prefs, [key]: !prefs[key as keyof typeof prefs] };
    setPrefs(newPrefs);
    try {
      await notificationService.updatePreferences(newPrefs);
    } catch (err) {
      console.error("Failed to update preferences:", err);
    }
  };

  const loadNotifications = async () => {
    try {
      setLoading(true);
      const res = await notificationService.getSystemNotifications();
      setNotifications(res.notifications);
      setUnreadCount(res.unreadCount);
    } catch (err) {
      console.error("Failed to load notifications:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, []);

  const handleMarkRead = async (id: string) => {
    try {
      await notificationService.markNotificationRead(id);
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
      setUnreadCount((prev) => Math.max(0, prev - 1));
      toast.push("Notification marked as read", "success");
    } catch (err: any) {
      console.error("Failed to mark notification read:", err);
      toast.push(err?.message || "Failed to mark notification as read", "error");
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationService.markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
      toast.push("All notifications marked as read", "success");
    } catch (err: any) {
      console.error("Failed to mark all read:", err);
      toast.push(err?.message || "Failed to mark all notifications as read", "error");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await notificationService.deleteNotification(id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      toast.push("Notification deleted", "success");
    } catch (err: any) {
      console.error("Failed to delete notification:", err);
      toast.push(err?.message || "Failed to delete notification", "error");
    }
  };

  const prefItems = [
    {
      key: "leaveRequests" as const,
      label: "Leave Requests",
      desc: "Notify when leave is applied, approved or rejected",
    },
    {
      key: "payrollReady" as const,
      label: "Payroll & Slips",
      desc: "Notify when salary slip is generated and ready for download",
    },
    {
      key: "birthdayReminders" as const,
      label: "Team Announcements",
      desc: "Company townhalls, policies, and team bulletins",
    },
    {
      key: "attendanceAlerts" as const,
      label: "Attendance Alerts",
      desc: "Alert when check-in or regularization status changes",
    },
    {
      key: "systemUpdates" as const,
      label: "System Alerts",
      desc: "Security gateway alerts, backups, and platform updates",
    },
  ];

  const filteredItems = notifications.filter((n) => (tab === "all" ? true : !n.read));

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case "critical":
        return <ShieldAlert className="h-5 w-5 text-rose-500 shrink-0" />;
      case "warning":
        return <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />;
      case "success":
        return <CheckCircle className="h-5 w-5 text-emerald-500 shrink-0" />;
      default:
        return <Info className="h-5 w-5 text-sky-500 shrink-0" />;
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <PageHeader
            title="Notifications & Alerts"
            subtitle="Real-time system alerts, broadcast notices, and preferences."
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadNotifications}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-input bg-background px-3 py-1.5 text-xs font-semibold hover:bg-accent transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:brightness-110 transition shadow-sm"
            >
              <CheckCheck className="w-3.5 h-3.5" /> Mark All Read ({unreadCount})
            </button>
          )}
        </div>
      </div>

      <div className="inline-flex rounded-xl border border-border bg-card p-1">
        {(["all", "unread", "prefs"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-lg px-4 py-1.5 text-xs font-semibold transition ${
              tab === t
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t === "all"
              ? `All (${notifications.length})`
              : t === "unread"
                ? `Unread (${unreadCount})`
                : "Preferences"}
          </button>
        ))}
      </div>

      {tab === "prefs" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {prefItems.map((item) => (
            <Card key={item.key} className="!p-4">
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1 pr-4">
                  <div className="text-sm font-semibold text-foreground">{item.label}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{item.desc}</div>
                </div>
                <button
                  onClick={() => handleTogglePref(item.key)}
                  className="text-primary shrink-0"
                >
                  {prefs[item.key] ? (
                    <ToggleRight className="h-7 w-7" />
                  ) : (
                    <ToggleLeft className="h-7 w-7 text-muted-foreground" />
                  )}
                </button>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="p-4 space-y-3">
          {loading ? (
            <div className="py-12 text-center text-xs text-muted-foreground">
              Loading real-time notifications...
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="py-12 text-center text-xs text-muted-foreground">
              {tab === "unread" ? "No unread notifications!" : "No notifications available."}
            </div>
          ) : (
            filteredItems.map((n) => (
              <div
                key={n.id}
                className={`flex items-start gap-3.5 rounded-xl border p-4 transition-all hover:border-primary/50 cursor-pointer ${
                  !n.read ? "bg-primary/5 border-primary/20" : "bg-card border-border"
                }`}
                onClick={() => {
                  setSelectedNotif(n);
                  if (!n.read) handleMarkRead(n.id);
                }}
              >
                <div className="pt-0.5">{getSeverityIcon(n.severity)}</div>
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <h4
                      className={`text-sm ${!n.read ? "font-bold text-foreground" : "font-semibold text-muted-foreground"}`}
                    >
                      {n.title}
                    </h4>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {formatAgo(n.timestamp || n.createdAt)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                    {n.message}
                  </p>
                  {(n.company || n.reason || n.recommendedAction) && (
                    <div className="flex flex-wrap gap-x-3 text-[11px] text-muted-foreground pt-1">
                      {n.company && (
                        <span>
                          Company: <strong className="text-foreground">{n.company}</strong>
                        </span>
                      )}
                      {n.reason && (
                        <span>
                          Reason:{" "}
                          <strong className="text-rose-600 dark:text-rose-400">{n.reason}</strong>
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <div
                  className="flex items-center gap-2 shrink-0 pt-0.5"
                  onClick={(e) => e.stopPropagation()}
                >
                  {!n.read && (
                    <button
                      onClick={() => handleMarkRead(n.id)}
                      className="p-1 text-muted-foreground hover:text-primary transition"
                      title="Mark as read"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(n.id)}
                    className="p-1 text-muted-foreground hover:text-rose-600 transition"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </Card>
      )}

      {/* Notification Detail Modal */}
      {selectedNotif && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-card border border-border rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-start justify-between gap-3 border-b border-border pb-3">
              <div className="flex items-center gap-2.5">
                {getSeverityIcon(selectedNotif.severity)}
                <div>
                  <h3 className="font-bold text-lg text-foreground leading-snug">
                    {selectedNotif.title}
                  </h3>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {formatAgo(selectedNotif.timestamp || selectedNotif.createdAt)}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setSelectedNotif(null)}
                className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-sm">
              <p className="text-muted-foreground leading-relaxed">{selectedNotif.message}</p>

              <div className="rounded-xl border border-border bg-muted/40 p-3.5 space-y-2 text-xs">
                {selectedNotif.company && (
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground font-medium">Company:</span>
                    <span className="font-bold text-foreground">{selectedNotif.company}</span>
                  </div>
                )}
                {selectedNotif.reason && (
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground font-medium">Reason:</span>
                    <span className="font-semibold text-rose-600 dark:text-rose-400">
                      {selectedNotif.reason}
                    </span>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground font-medium">Time:</span>
                  <span className="font-medium text-foreground">
                    {new Date(
                      selectedNotif.timestamp || selectedNotif.createdAt || Date.now(),
                    ).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                {selectedNotif.recommendedAction && (
                  <div className="pt-1 border-t border-border">
                    <span className="text-muted-foreground font-medium block mb-0.5">
                      Recommended Action:
                    </span>
                    <span className="font-semibold text-amber-600 dark:text-amber-400 block">
                      {selectedNotif.recommendedAction}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setSelectedNotif(null)}
                className="px-4 py-2 text-xs font-semibold rounded-lg border border-input bg-background hover:bg-accent transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================================================
   SETTINGS (role-scoped)
   ============================================================ */

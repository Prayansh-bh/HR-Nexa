import React, { useState, useEffect, useMemo } from "react";
import {
  Zap,
  RefreshCw,
  Check,
  AlertCircle,
  Info,
  ShieldAlert,
  Trash2,
  ExternalLink,
  Loader2,
  Search,
} from "lucide-react";
import { notificationService, SystemNotification } from "../../../services/notification.service";
import { companyService } from "../../../services/company.service";

const cardCls =
  "rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)] transition hover:shadow-[var(--shadow-elevated)]";
const inputCls =
  "h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20";
const btnCls =
  "inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition hover:brightness-110 px-3 py-1.5 text-xs bg-primary text-white";

function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 className="text-xl font-bold tracking-tight md:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {action && <div className="flex gap-2">{action}</div>}
    </div>
  );
}

function Badge({
  children,
  tone = "slate",
}: {
  children: React.ReactNode;
  tone?: "slate" | "green" | "amber" | "rose" | "indigo" | "sky";
}) {
  const tones = {
    slate: "bg-muted text-muted-foreground",
    green: "bg-[color:var(--color-success)]/15 text-[color:var(--color-success)]",
    amber: "bg-[color:var(--color-warning)]/15 text-[color:var(--color-warning)]",
    rose: "bg-destructive/15 text-destructive",
    indigo: "bg-primary/15 text-primary",
    sky: "bg-[color:var(--color-info)]/15 text-[color:var(--color-info)]",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export function SuperAdminNotificationsPage({
  toast,
}: {
  toast?: (msg: string, type?: "success" | "error" | "info") => void;
}) {
  const [notifications, setNotifications] = useState<SystemNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [filterSeverity, setFilterSeverity] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [companiesList, setCompaniesList] = useState<{ id: string; name: string }[]>([]);

  // Broadcast Form State
  const [form, setForm] = useState({
    title: "",
    message: "",
    severity: "info",
    category: "system",
    targetRole: "ALL",
    company: "",
    reason: "",
    recommendedAction: "",
    linkUrl: "",
  });

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
    companyService
      .getCompanies()
      .then((res) => {
        if (Array.isArray(res)) {
          setCompaniesList(res.map((c) => ({ id: c.id, name: c.name })));
        }
      })
      .catch((err) => console.error("Failed to load companies for dropdown:", err));
  }, []);

  const handleBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.message) return;
    try {
      setIsSubmitting(true);
      await notificationService.broadcastSystemNotification(form);
      toast?.("Broadcast notification sent successfully!", "success");
      setForm({
        title: "",
        message: "",
        severity: "info",
        category: "system",
        targetRole: "ALL",
        company: "",
        reason: "",
        recommendedAction: "",
        linkUrl: "",
      });
      await loadNotifications();
    } catch (err: any) {
      toast?.(err?.message || "Failed to send broadcast", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMarkRead = async (id: string) => {
    try {
      await notificationService.markNotificationRead(id);
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
      setUnreadCount((prev) => Math.max(0, prev - 1));
      toast?.("Notification marked as read", "success");
    } catch (err: any) {
      console.error("Failed to mark read:", err);
      toast?.(err?.message || "Failed to mark notification as read", "error");
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationService.markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
      toast?.("All notifications marked as read", "success");
    } catch (err: any) {
      console.error("Failed to mark all read:", err);
      toast?.(err?.message || "Failed to mark all notifications as read", "error");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await notificationService.deleteNotification(id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      toast?.("Notification deleted", "success");
    } catch (err: any) {
      console.error("Failed to delete notification:", err);
      toast?.(err?.message || "Failed to delete notification", "error");
    }
  };

  const filteredNotifications = useMemo(() => {
    return notifications.filter((n) => {
      const matchSeverity = filterSeverity === "all" || n.severity === filterSeverity;
      const matchSearch =
        !searchQuery ||
        n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        n.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (n.company && n.company.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchSeverity && matchSearch;
    });
  }, [notifications, filterSeverity, searchQuery]);

  return (
    <div className="space-y-6 w-full max-w-7xl mx-auto min-w-0 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Global Notifications & Alerts</h1>
          <p className="text-sm text-muted-foreground">
            Broadcast platform announcements and review real-time system alerts.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={loadNotifications}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-input bg-background px-3 py-2 text-xs font-semibold hover:bg-accent transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="inline-flex items-center gap-2 rounded-lg font-semibold transition px-4 py-2 text-xs bg-primary text-primary-foreground hover:brightness-110 shadow-sm"
            >
              <Check className="w-4 h-4" /> Mark All Read ({unreadCount})
            </button>
          )}
        </div>
      </div>

      {/* Grid Layout: Broadcast Composer + System Alerts Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Broadcast Composer Form */}
        <div className={cardCls + " space-y-4"}>
          <div className="border-b border-border pb-3">
            <h3 className="font-bold text-lg flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-500" /> Broadcast Composer
            </h3>
            <p className="text-xs text-muted-foreground">
              Publish global alerts across all user dashboards.
            </p>
          </div>

          <form onSubmit={handleBroadcast} className="space-y-3.5 text-xs">
            <div>
              <label className="font-semibold text-muted-foreground block mb-1">
                Title / Subject *
              </label>
              <input
                type="text"
                required
                value={form.title}
                id="broadcastTitle"
                name="broadcastTitle"
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="e.g. System Maintenance Notice"
                className={inputCls}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="font-semibold text-muted-foreground block mb-1">
                  Target Role / Audience
                </label>
                <select
                  value={form.targetRole}
                  id="broadcastRole"
                  name="broadcastRole"
                  onChange={(e) => setForm({ ...form, targetRole: e.target.value })}
                  className={inputCls}
                >
                  <option value="ALL">Everyone (All Roles)</option>
                  <option value="HRAdmin">HR Admins</option>
                  <option value="Manager">Managers</option>
                  <option value="Employee">Employees</option>
                  <option value="Accountant">Accountants</option>
                  <option value="SuperAdmin">Super Admins Only</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-muted-foreground block mb-1">
                  Severity Indicator
                </label>
                <select
                  value={form.severity}
                  id="broadcastSeverity"
                  name="broadcastSeverity"
                  onChange={(e) => setForm({ ...form, severity: e.target.value })}
                  className={inputCls}
                >
                  <option value="info">🔵 Info (Blue)</option>
                  <option value="success">🟢 Success (Green)</option>
                  <option value="warning">🟡 Warning (Yellow)</option>
                  <option value="critical">🔴 Critical (Red)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="font-semibold text-muted-foreground block mb-1">Category</label>
                <select
                  value={form.category}
                  id="broadcastCategory"
                  name="broadcastCategory"
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className={inputCls}
                >
                  <option value="system">System</option>
                  <option value="subscription">Subscription</option>
                  <option value="billing">Billing</option>
                  <option value="security">Security</option>
                  <option value="backup">Backup</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-muted-foreground block mb-1">
                  Target Company (Optional)
                </label>
                <select
                  value={form.company}
                  onChange={(e) => setForm({ ...form, company: e.target.value })}
                  className={inputCls}
                >
                  <option value="">All Companies (Global Broadcast)</option>
                  {companiesList.map((c) => (
                    <option key={c.id} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="font-semibold text-muted-foreground block mb-1">
                  Module Link (Optional)
                </label>
                <input
                  type="text"
                  value={form.linkUrl}
                  onChange={(e) => setForm({ ...form, linkUrl: e.target.value })}
                  placeholder="e.g. saas.subscriptions"
                  className={inputCls}
                />
              </div>

              <div>
                <label className="font-semibold text-muted-foreground block mb-1">
                  Recommended Action (Optional)
                </label>
                <input
                  type="text"
                  value={form.recommendedAction}
                  onChange={(e) => setForm({ ...form, recommendedAction: e.target.value })}
                  placeholder="e.g. Contact customer to renew subscription"
                  className={inputCls}
                />
              </div>
            </div>

            <div>
              <label className="font-semibold text-muted-foreground block mb-1">
                Broadcast Message *
              </label>
              <textarea
                required
                value={form.message}
                id="broadcastMessage"
                name="broadcastMessage"
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                className={inputCls + " h-24 py-2 resize-none"}
                placeholder="Write announcement body..."
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition px-4 py-2.5 text-xs bg-primary text-primary-foreground hover:brightness-110 shadow-sm"
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Zap className="w-4 h-4" />
              )}
              Publish Broadcast
            </button>
          </form>
        </div>

        {/* Right Column: Live Notifications Feed Table */}
        <div className={cardCls + " lg:col-span-2 space-y-4 flex flex-col justify-between"}>
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
              <div>
                <h3 className="font-bold text-lg">System Notifications Feed</h3>
                <p className="text-xs text-muted-foreground">
                  Real-time alerts, billing failures, and system diagnostics.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={filterSeverity}
                  onChange={(e) => setFilterSeverity(e.target.value)}
                  className={inputCls + " !w-auto text-xs"}
                >
                  <option value="all">All Severities</option>
                  <option value="critical">🔴 Critical</option>
                  <option value="warning">🟡 Warning</option>
                  <option value="success">🟢 Success</option>
                  <option value="info">🔵 Info</option>
                </select>
              </div>
            </div>

            <div className="relative">
              <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search notifications by title, message, or company..."
                className={inputCls + " pl-9"}
              />
            </div>

            {/* List View */}
            <div className="space-y-2.5 max-h-[520px] overflow-y-auto pr-1">
              {loading ? (
                <div className="py-12 text-center text-muted-foreground text-xs">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-primary" />
                  Loading real-time notifications...
                </div>
              ) : filteredNotifications.length === 0 ? (
                <div className="py-12 text-center text-xs text-muted-foreground">
                  No notifications match your current filter or search criteria.
                </div>
              ) : (
                filteredNotifications.map((n) => (
                  <div
                    key={n.id}
                    className={`p-3.5 rounded-xl border transition-all space-y-2 ${
                      !n.read
                        ? "bg-primary/5 border-primary/20 shadow-sm"
                        : "bg-muted/30 border-border hover:bg-muted/60"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2">
                        {n.severity === "critical" && (
                          <span
                            className="h-3 w-3 rounded-full bg-rose-500 shrink-0"
                            title="Critical"
                          />
                        )}
                        {n.severity === "warning" && (
                          <span
                            className="h-3 w-3 rounded-full bg-amber-500 shrink-0"
                            title="Warning"
                          />
                        )}
                        {n.severity === "success" && (
                          <span
                            className="h-3 w-3 rounded-full bg-emerald-500 shrink-0"
                            title="Success"
                          />
                        )}
                        {n.severity === "info" && (
                          <span className="h-3 w-3 rounded-full bg-sky-500 shrink-0" title="Info" />
                        )}
                        <h4 className="font-bold text-sm text-foreground">{n.title}</h4>
                        {!n.read && <Badge tone="rose">Unread</Badge>}
                      </div>
                      <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                        {new Date(n.timestamp || n.createdAt || Date.now()).toLocaleString()}
                      </span>
                    </div>

                    <p className="text-xs text-muted-foreground leading-relaxed">{n.message}</p>

                    {(n.company || n.reason || n.recommendedAction) && (
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] bg-background/60 p-2 rounded-lg border border-border/50">
                        {n.company && (
                          <div>
                            <span className="text-muted-foreground font-medium">Company:</span>{" "}
                            <strong className="text-foreground">{n.company}</strong>
                          </div>
                        )}
                        {n.reason && (
                          <div>
                            <span className="text-muted-foreground font-medium">Reason:</span>{" "}
                            <strong className="text-rose-600 dark:text-rose-400">{n.reason}</strong>
                          </div>
                        )}
                        {n.recommendedAction && (
                          <div>
                            <span className="text-muted-foreground font-medium">Action:</span>{" "}
                            <strong className="text-amber-600 dark:text-amber-400">
                              {n.recommendedAction}
                            </strong>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="flex items-center justify-end gap-2 pt-1 border-t border-border/40">
                      {!n.read && (
                        <button
                          onClick={() => handleMarkRead(n.id)}
                          className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1"
                        >
                          <Check className="w-3.5 h-3.5" /> Mark Read
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(n.id)}
                        className="text-xs font-semibold text-rose-600 dark:text-rose-400 hover:underline inline-flex items-center gap-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Delete
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

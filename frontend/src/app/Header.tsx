import React, { useState, useEffect } from "react";
import {
  Menu,
  Sun,
  Moon,
  Bell,
  ChevronDown,
  User as UserIcon,
  LogOut,
  CheckCheck,
  ExternalLink,
  X,
  AlertTriangle,
  ShieldAlert,
  CheckCircle,
  Info,
} from "lucide-react";
import { Badge, Avatar } from "../components/ui";
import { useClickOutside } from "../hooks";
import { ROLE_LABEL } from "../features/auth";
import type { AuthUser } from "../types";
import { notificationService, SystemNotification } from "../services/notification.service";
import { useTheme } from "../context";

interface HeaderProps {
  user: AuthUser;
  onLogout: () => void;
  today: string;
  company: string;
  setCompany: (v: string) => void;
  onMenu: () => void;
  onNav: (id: string) => void;
}

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

export function Header({
  user,
  onLogout,
  today,
  company,
  setCompany,
  onMenu,
  onNav,
}: HeaderProps) {
  const { isDark, toggleTheme } = useTheme();
  const [profileOpen, setProfileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [companyOpen, setCompanyOpen] = useState(false);

  const [sysNotifications, setSysNotifications] = useState<SystemNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [selectedNotif, setSelectedNotif] = useState<SystemNotification | null>(null);

  const profileRef = useClickOutside<HTMLDivElement>(() => setProfileOpen(false));
  const notifRef = useClickOutside<HTMLDivElement>(() => setNotifOpen(false));
  const companyRef = useClickOutside<HTMLDivElement>(() => setCompanyOpen(false));

  const inFlightRef = React.useRef(false);

  const loadNotifications = async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    try {
      const res = await notificationService.getSystemNotifications();
      setSysNotifications(res.notifications);
      setUnreadCount(res.unreadCount);
    } catch (err) {
      console.error("Failed to fetch system notifications:", err);
    } finally {
      inFlightRef.current = false;
    }
  };

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 30000); // 30s polling
    return () => {
      clearInterval(interval);
      inFlightRef.current = false;
    };
  }, []);

  const handleMarkAllRead = async () => {
    try {
      await notificationService.markAllNotificationsRead();
      setSysNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error("Failed to mark all read:", err);
    }
  };

  const handleSelectNotif = async (n: SystemNotification) => {
    setSelectedNotif(n);
    setNotifOpen(false);
    if (!n.read) {
      try {
        await notificationService.markNotificationRead(n.id);
        setSysNotifications((prev) =>
          prev.map((item) => (item.id === n.id ? { ...item, read: true } : item)),
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      } catch (err) {
        console.error("Failed to mark notification read:", err);
      }
    }
  };

  const getSeverityIndicator = (severity: string) => {
    switch (severity) {
      case "critical":
        return (
          <span
            className="inline-block h-2.5 w-2.5 rounded-full bg-rose-500 shadow-sm shrink-0"
            title="Critical Alert"
          />
        );
      case "warning":
        return (
          <span
            className="inline-block h-2.5 w-2.5 rounded-full bg-amber-500 shadow-sm shrink-0"
            title="Warning"
          />
        );
      case "success":
        return (
          <span
            className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-sm shrink-0"
            title="Success"
          />
        );
      default:
        return (
          <span
            className="inline-block h-2.5 w-2.5 rounded-full bg-sky-500 shadow-sm shrink-0"
            title="Info"
          />
        );
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case "critical":
        return <ShieldAlert className="h-5 w-5 text-rose-500" />;
      case "warning":
        return <AlertTriangle className="h-5 w-5 text-amber-500" />;
      case "success":
        return <CheckCircle className="h-5 w-5 text-emerald-500" />;
      default:
        return <Info className="h-5 w-5 text-sky-500" />;
    }
  };

  return (
    <>
      <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-border bg-card/80 px-3 backdrop-blur-xl md:px-6">
        <button
          onClick={onMenu}
          className="lg:hidden grid h-9 w-9 place-items-center rounded-lg text-muted-foreground hover:bg-muted transition"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="hidden flex-1 md:block animate-in fade-in slide-in-from-left-2 duration-500">
          <div className="text-sm font-bold text-foreground">
            Welcome back, {user.name.split(" ")[0]} 👋
          </div>
          <div className="text-xs text-muted-foreground">
            {ROLE_LABEL[user.role as keyof typeof ROLE_LABEL] || user.role} - Here's what's
            happening today.
          </div>
        </div>

        <div className="ml-auto flex items-center gap-1.5 md:gap-2">
          <span className="hidden lg:inline text-xs font-medium text-muted-foreground">
            {today}
          </span>

          <button
            onClick={toggleTheme}
            className="grid h-9 w-9 place-items-center rounded-lg border border-border bg-card transition hover:shadow-md"
            aria-label="Toggle theme"
          >
            {isDark ? (
              <Sun className="h-4 w-4 text-warning" />
            ) : (
              <Moon className="h-4 w-4 text-primary" />
            )}
          </button>

          {/* Notifications Dropdown */}
          <div ref={notifRef} className="relative">
            <button
              onClick={() => {
                setNotifOpen((o) => !o);
                setProfileOpen(false);
                setCompanyOpen(false);
              }}
              className="relative grid h-9 w-9 place-items-center rounded-lg border border-border bg-card transition hover:shadow-md"
              aria-label="Notifications"
            >
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white shadow-sm ring-2 ring-background">
                  {unreadCount}
                </span>
              )}
            </button>

            {notifOpen && (
              <div className="absolute right-0 top-11 w-88 md:w-96 rounded-2xl border border-border bg-popover p-3 shadow-2xl animate-in fade-in slide-in-from-top-2 duration-150 z-50">
                <div className="flex items-center justify-between border-b border-border pb-2 px-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-foreground">Notifications</span>
                    {unreadCount > 0 && (
                      <span className="rounded-full bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400 px-2 py-0.5 text-[11px] font-bold">
                        {unreadCount} unread
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {unreadCount > 0 && (
                      <button
                        onClick={handleMarkAllRead}
                        className="text-xs text-muted-foreground hover:text-foreground font-medium flex items-center gap-1 transition"
                        title="Mark all as read"
                      >
                        <CheckCheck className="w-3.5 h-3.5" /> Mark All Read
                      </button>
                    )}
                    <button
                      onClick={() => {
                        onNav(user.role === "SuperAdmin" ? "saas.notifications" : "notifications");
                        setNotifOpen(false);
                      }}
                      className="text-xs text-primary font-bold hover:underline"
                    >
                      View All
                    </button>
                  </div>
                </div>

                <div className="mt-2 space-y-1.5 max-h-80 overflow-y-auto pr-0.5">
                  {sysNotifications.length === 0 ? (
                    <div className="text-center py-8 text-xs text-muted-foreground">
                      No notifications available.
                    </div>
                  ) : (
                    sysNotifications.slice(0, 6).map((n) => (
                      <div
                        key={n.id}
                        onClick={() => handleSelectNotif(n)}
                        className={`flex items-start gap-2.5 rounded-xl p-2.5 transition cursor-pointer border ${
                          !n.read
                            ? "bg-primary/5 border-primary/20 hover:bg-primary/10"
                            : "bg-muted/30 border-transparent hover:bg-muted/60"
                        }`}
                      >
                        <div className="pt-1">{getSeverityIndicator(n.severity)}</div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-1">
                            <h4
                              className={`text-xs font-semibold truncate ${!n.read ? "text-foreground font-bold" : "text-muted-foreground"}`}
                            >
                              {n.title}
                            </h4>
                            <span className="text-[10px] text-muted-foreground shrink-0 whitespace-nowrap">
                              {formatAgo(n.timestamp || n.createdAt)}
                            </span>
                          </div>
                          <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">
                            {n.message}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Profile */}
          <div ref={profileRef} className="relative">
            <button
              onClick={() => {
                setProfileOpen((o) => !o);
                setNotifOpen(false);
                setCompanyOpen(false);
              }}
              className="flex h-9 items-center gap-2 rounded-lg pl-1 pr-2 transition hover:bg-muted"
            >
              <Avatar
                src={user.avatar}
                initials={user.initials}
                name={user.name}
                id={user.employeeId || user.id}
                size={28}
                className="h-7 w-7 text-xs"
              />
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
            {profileOpen && (
              <div className="absolute right-0 top-11 w-60 rounded-xl border border-border bg-popover p-1 shadow-xl animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="border-b border-border px-3 py-2.5">
                  <div className="text-sm font-bold">{user.name}</div>
                  <div className="text-xs text-muted-foreground">{user.email}</div>
                  <div className="mt-1.5">
                    <Badge tone="indigo">
                      {ROLE_LABEL[user.role as keyof typeof ROLE_LABEL] || user.role}
                    </Badge>
                  </div>
                </div>
                {[
                  { icon: UserIcon, label: "My Profile", nav: "profile" },
                  { icon: ShieldAlert, label: "Security & Password", nav: "settings.security" },
                  {
                    icon: Bell,
                    label: "Notification Prefs",
                    nav: user.role === "SuperAdmin" ? "saas.notifications" : "notifications",
                  },
                ].map(({ icon: I, label, nav }) => (
                  <button
                    key={label}
                    onClick={() => {
                      onNav(nav);
                      setProfileOpen(false);
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition hover:bg-muted"
                  >
                    <I className="h-4 w-4" /> {label}
                  </button>
                ))}
                <button
                  onClick={onLogout}
                  className="mt-1 flex w-full items-center gap-2 rounded-lg border-t border-border px-3 py-2 text-sm text-destructive transition hover:bg-destructive/10"
                >
                  <LogOut className="h-4 w-4" /> Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

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
              {selectedNotif.linkUrl && (
                <button
                  onClick={() => {
                    const target = selectedNotif.linkUrl || "saas.subscriptions";
                    onNav(target);
                    setSelectedNotif(null);
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:brightness-110 transition shadow-sm"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Open{" "}
                  {selectedNotif.category === "subscription"
                    ? "Subscription"
                    : selectedNotif.category === "backup"
                      ? "Backups"
                      : "Module"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

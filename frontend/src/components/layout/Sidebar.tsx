import React from "react";
import { useRouter } from "@tanstack/react-router";
import { X, ChevronRight } from "lucide-react";
import { AuthUser } from "../../types";
import { ROLE_LABEL } from "../../features/auth";
import { useNavigation } from "../../hooks/useNavigation";
import { getPathFromId } from "../../lib/nav-config";
import { Logo, Avatar } from "../ui";
import { useTranslation } from "react-i18next";

interface SidebarProps {
  user: AuthUser;
}

export function Sidebar({ user }: SidebarProps) {
  const router = useRouter();
  const { t } = useTranslation();

  const getNavLabel = (id: string, fallback: string) => {
    const navKeyMap: Record<string, string> = {
      dashboard: "nav.dashboard",
      employees: "nav.employees",
      attendance: "nav.attendance",
      leaves: "nav.leaves",
      payroll: "nav.payroll",
      performance: "nav.performance",
      documents: "nav.documents",
      reports: "nav.reports",
      settings: "nav.settings",
      billing: "nav.billing",
      companies: "nav.companies",
    };
    const key = navKeyMap[id];
    return key ? t(key, fallback) : fallback;
  };

  const {
    active,
    mobileOpen,
    openGroup,
    collapsed,
    setMobileOpen,
    setOpenGroup,
    setCollapsed,
    pickNav,
    unreadAnnouncements,
    unreadMessagesCount,
    nav,
  } = useNavigation(user);

  const handleMouseEnter = (id: string) => {
    try {
      router.preloadRoute({ to: getPathFromId(id) });
    } catch {}
  };

  return (
    <>
      {mobileOpen && (
        <button
          aria-label="Close sidebar"
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-sm lg:hidden"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex flex-col border-r border-border bg-card transition-[width,transform] duration-300 ${
          mobileOpen ? "translate-x-0 w-72" : "-translate-x-full w-72"
        } ${collapsed ? "lg:w-20" : "lg:w-64"} lg:translate-x-0`}
      >
        <div className="flex h-16 shrink-0 items-center gap-3 border-b border-border px-4">
          <div className="flex shrink-0 items-center justify-center p-1">
            <Logo className="h-9 w-auto" />
          </div>
          {(!collapsed || mobileOpen) && (
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-bold">HR Nexa</div>
              <div className="truncate text-[10px] text-muted-foreground">
                Empowering People, Elevating Business
              </div>
            </div>
          )}
          <button
            onClick={() => setMobileOpen(false)}
            className="lg:hidden grid h-9 w-9 place-items-center rounded-lg text-muted-foreground hover:bg-muted transition"
            aria-label="Close sidebar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Role badge */}
        {(!collapsed || mobileOpen) && (
          <div className="px-4 py-2 border-b border-border">
            <div className="flex items-center gap-2 rounded-lg bg-primary/10 px-3 py-1.5">
              <Avatar
                src={user.avatar}
                initials={user.initials}
                name={user.name}
                id={user.employeeId || user.id}
                size={20}
                className="h-5 w-5 text-[9px]"
              />
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-semibold">{user.name}</div>
                <div className="truncate text-[10px] text-primary font-medium">
                  {ROLE_LABEL[user.role]}
                </div>
              </div>
            </div>
          </div>
        )}

        <nav className="flex flex-col gap-0.5 overflow-y-auto p-3 flex-1">
          {nav.map((item) => {
            const Icon = item.icon;
            const hasChildren = !!item.children;
            const isDirectMatch =
              active === item.id ||
              (item.id === "self.expenses" && (active === "payroll.reimbursements" || active === "self.expenses")) ||
              (item.id === "announcements" && (active === "self.announcements" || active === "announcements")) ||
              (item.id === "self.announcements" && (active === "announcements" || active === "self.announcements"));

            const isChildMatch =
              hasChildren &&
              item.children!.some(
                (c) => c.id === active || (active.startsWith(c.id + ".") && c.id !== item.id),
              );

            const isActive = isDirectMatch || isChildMatch;
            const isOpen = openGroup === item.id;
            const showLabel = !collapsed || mobileOpen;
            return (
              <div key={item.id}>
                <button
                  onMouseEnter={() => handleMouseEnter(item.id)}
                  onClick={() => {
                    if (hasChildren) {
                      const willOpen = !isOpen;
                      setOpenGroup(willOpen ? item.id : null);
                      if (willOpen) pickNav(item.children![0].id);
                    } else {
                      setOpenGroup(null);
                      pickNav(item.id);
                    }
                  }}
                  title={collapsed && !mobileOpen ? item.label : undefined}
                  className={`group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                    isActive
                      ? "bg-accent text-accent-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <Icon
                    className={`h-4.5 w-4.5 shrink-0 ${isActive ? "text-primary" : ""}`}
                    size={18}
                  />
                  {showLabel && (
                    <span className="flex-1 truncate text-left relative">
                      {getNavLabel(item.id, item.label)}
                      {(item.id === "self.announcements" || item.id === "announcements") && unreadAnnouncements && (
                        <span className="absolute -top-1 -right-1 flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                        </span>
                      )}
                      {item.id === "inbox" && unreadMessagesCount > 0 && (
                        <span className="absolute -top-1 -right-1 flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                        </span>
                      )}
                    </span>
                  )}
                  {showLabel && hasChildren && (
                    <ChevronRight
                      className={`h-4 w-4 transition-transform ${isOpen ? "rotate-90" : ""}`}
                    />
                  )}
                </button>
                {showLabel && hasChildren && isOpen && (
                  <div className="ml-4 mt-0.5 flex flex-col gap-0.5 border-l border-border pl-3 animate-in slide-in-from-top-1 fade-in duration-150">
                    {item.children!.map((c) => (
                      <button
                        key={c.id}
                        onMouseEnter={() => handleMouseEnter(c.id)}
                        onClick={() => pickNav(c.id)}
                        className={`rounded-md px-3 py-1.5 text-left text-xs font-medium transition ${
                          active === c.id
                            ? "text-primary bg-primary/10"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {c.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className="border-t border-border p-3">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="hidden lg:flex w-full items-center gap-3 rounded-lg px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground transition"
          >
            <ChevronRight
              className={`h-4 w-4 transition-transform ${collapsed ? "" : "rotate-180"}`}
            />
            {!collapsed && <span>Collapse</span>}
          </button>
        </div>
      </aside>
    </>
  );
}

import React, { useMemo, useEffect } from "react";
import { useToast, useNavigation, useAttendanceAutoSync } from "../hooks";
import { Outlet } from "@tanstack/react-router";
import { Header } from "./Header";
import { ModalManager } from "../components/modals/ModalManager";
import { Sidebar } from "../components/layout/Sidebar";
import { ImpersonationBanner } from "../components/layout/ImpersonationBanner";
import { PlatformAlertBanner } from "../components/layout/PlatformAlertBanner";
import { MessagingProvider } from "../providers/MessagingProvider";
import { useUIStore, useMessagingStore } from "../store";
import { realtimeEventsService } from "../services/realtimeEvents.service";
import type { AuthUser } from "../types";

interface ShellProps {
  user: AuthUser;
  setUser: (u: AuthUser | null) => void;
  onLogout: () => void;
}

export function Shell({ user, setUser, onLogout }: ShellProps) {
  const { active, mobileOpen, collapsed, setMobileOpen, pickNav } = useNavigation(user);
  const company = useUIStore((s) => s.company);
  const setCompany = useUIStore((s) => s.setCompany);
  const toast = useToast();

  const handleLogout = () => {
    useMessagingStore.getState().clear();
    onLogout();
  };

  const today = useMemo(
    () =>
      new Date().toLocaleDateString("en-US", {
        weekday: "long",
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
    [],
  );

  const toastPush = toast.push;

  useEffect(() => {
    return realtimeEventsService.subscribeEvents((event) => {
      if (event.type === "performance.review.created") {
        if (user.role === "Employee")
          toastPush("A new performance review has been assigned to you.");
      } else if (event.type === "performance.review.updated") {
        if (event.payload?.status === "Manager Review" && user.role === "Manager") {
          toastPush("A team member has submitted their self-assessment.");
        } else if (
          event.payload?.status === "HR Review" &&
          ["HRAdmin", "SuperAdmin"].includes(user.role)
        ) {
          toastPush("A manager has completed their team assessment.");
        }
      } else if (event.type === "performance.review.completed") {
        if (user.role === "Employee") toastPush("Your performance review has been finalized.");
      }
    });
  }, [user.role, toastPush]);

  useAttendanceAutoSync();

  const triggerConfirm = (message: string, onConfirm: () => void, title = "Confirm Action") => {
    const { setConfirmState } = useUIStore.getState();
    setConfirmState({
      open: true,
      title,
      message,
      onConfirm: () => {
        onConfirm();
        setConfirmState({ open: false, message: "", onConfirm: () => {} });
      },
    });
  };
  return (
    <MessagingProvider user={user}>
      <div className="min-h-screen bg-background text-foreground transition-colors">
        <Sidebar user={user} />

        {/* MAIN */}
        <div className={`transition-[margin] duration-300 ${collapsed ? "lg:ml-20" : "lg:ml-64"}`}>
          <PlatformAlertBanner />
          <ImpersonationBanner user={user} setUser={setUser} />

          <Header
            user={user}
            onLogout={handleLogout}
            today={today}
            company={company}
            setCompany={setCompany}
            onMenu={() => setMobileOpen(true)}
            onNav={pickNav}
          />

          <main className="p-4 md:p-6 lg:p-8">
            <Outlet />
          </main>
        </div>

        {/* MODALS */}
        <ModalManager user={user} />
        <toast.ToastHost />
      </div>
    </MessagingProvider>
  );
}

import { createFileRoute, redirect } from "@tanstack/react-router";
import React, { useEffect, useState } from "react";
import { Shell } from "../app/Shell";
import { useLocalStorage } from "../hooks";
import { useAuth } from "../auth";
import { AuthUser } from "../types";
import { authService } from "../services/auth.service";

import { ErrorComponentProps } from "@tanstack/react-router";

function AppErrorComponent({ error, reset }: ErrorComponentProps) {
  return (
    <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-6 text-center my-6">
      <h3 className="text-lg font-bold text-destructive">Component failed to load</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        {error.message || "An unexpected error occurred."}
      </p>
      <button onClick={reset} className="mt-4 rounded-lg bg-primary px-3 py-1.5 text-xs text-white">
        Retry
      </button>
    </div>
  );
}

export const Route = createFileRoute("/_app")({
  beforeLoad: () => {
    const userString = typeof window !== "undefined" ? localStorage.getItem("hrms.user") : null;
    if (!userString) {
      throw redirect({ to: "/login" });
    }
  },
  errorComponent: AppErrorComponent,
  component: AppLayout,
});

function AppLayout() {
  const { user, setUser, clearAuth } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [syncingPermissions, setSyncingPermissions] = useState(true);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleLogout = async () => {
    try {
      await authService.logout();
    } catch {}
    clearAuth();
    window.location.href = "/login";
  };

  // Re-hydrate user profile and live effective permissions from the server on every session initialization.
  // The live /auth/me/permissions response is saved to Zustand & localStorage, serving as authoritative frontend state.
  useEffect(() => {
    let cancelled = false;

    async function syncSession() {
      try {
        const [profile, permsData] = await Promise.all([
          authService.getProfile(),
          authService.getMyPermissions(),
        ]);

        if (!cancelled && profile && !profile.error && user) {
          const freshPermissions =
            permsData && !permsData.error && Array.isArray(permsData.permissions)
              ? permsData.permissions
              : Array.isArray(profile.permissions)
              ? profile.permissions
              : user.permissions || [];

          const updatedUser: AuthUser = {
            ...user,
            id: profile.id || user.id,
            email: profile.email || user.email,
            name: profile.name || user.name,
            role: profile.role || user.role,
            companyId: profile.companyId !== undefined ? profile.companyId : user.companyId,
            subscriptionId: profile.subscriptionId !== undefined ? profile.subscriptionId : user.subscriptionId,
            companyName: profile.companyName !== undefined ? profile.companyName : user.companyName,
            company: profile.companyName !== undefined ? profile.companyName : user.company,
            employeeId: profile.employee?.id || user.employeeId || null,
            avatar: profile.employee?.avatar || profile.avatar || user.avatar || null,
            permissions: freshPermissions,
            initials: user.initials || (profile.name ? profile.name.slice(0, 2).toUpperCase() : "HR"),
          };

          const { useAuthStore } = await import("../store/authStore");
          useAuthStore.getState().setUser(updatedUser);
        }
      } catch (err) {
        console.warn("Non-fatal session hydration warning:", err);
      } finally {
        if (!cancelled) {
          setSyncingPermissions(false);
        }
      }
    }

    void syncSession();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!mounted || !user || syncingPermissions) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <Shell user={user} setUser={setUser} onLogout={handleLogout} />
  );
}

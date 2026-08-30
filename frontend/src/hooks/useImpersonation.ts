import { useState, useCallback, useSyncExternalStore } from "react";
import { AuthUser } from "../types";
import { authService } from "../services/auth.service";
import { useAuthStore } from "../store/authStore";
import { realtimeEventsService } from "../services/realtimeEvents.service";
import { OWNER_APP_URL } from "../config/api";

function subscribe(callback: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("storage", callback);
  window.addEventListener("impersonation-updated", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("impersonation-updated", callback);
  };
}

function getImpersonationSnapshot(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("hrms.impersonator");
}

export function useImpersonation(setUser?: (u: AuthUser | null) => void) {
  const [isExiting, setIsExiting] = useState(false);
  const authUser = useAuthStore((s) => s.user);

  useSyncExternalStore(subscribe, getImpersonationSnapshot, () => null);

  let isImpersonating = false;
  let impersonatedCompany = "";

  if (typeof window !== "undefined") {
    const rawImpersonator = localStorage.getItem("hrms.impersonator");
    const originalToken = localStorage.getItem("hrms.impersonation.originalToken");

    if (rawImpersonator && authUser && authUser.role === "HRAdmin") {
      isImpersonating = true;
      impersonatedCompany = rawImpersonator;
    } else if (rawImpersonator && authUser && authUser.role === "SuperAdmin") {
      authService.clearImpersonationState();
    }
  }

  const exitImpersonation = useCallback(async () => {
    if (isExiting) return;
    setIsExiting(true);
    try {
      const ownerUrl =
        (typeof window !== "undefined" &&
          localStorage.getItem("hrms.impersonator.ownerUrl")) ||
        OWNER_APP_URL;

      // Purge tenant impersonation session cleanly
      authService.clearImpersonationState();
      authService.removeAccessToken();
      authService.removeRefreshToken();
      if (typeof window !== "undefined") {
        localStorage.removeItem("hrms.user");
        localStorage.removeItem("hrms.impersonator");
        localStorage.removeItem("hrms.impersonator.ownerUrl");
      }
      useAuthStore.getState().clearAuth();

      if (typeof window !== "undefined") {
        window.location.href = `${ownerUrl}/dashboard`;
      }
    } catch (err: any) {
      console.error("Exit impersonation failed:", err);
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
    } finally {
      setIsExiting(false);
    }
  }, [isExiting]);

  return {
    isImpersonating,
    impersonatedCompany,
    exitImpersonation,
    isExiting,
  };
}


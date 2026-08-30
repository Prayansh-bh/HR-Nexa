import { create } from "zustand";
import type { AuthUser } from "../types";

export interface AuthStore {
  user: AuthUser | null;
  permissions: string[];
  setUser: (user: AuthUser | null) => void;
  setPermissions: (permissions: string[]) => void;
  updateUserPermissions: (permissions: string[]) => void;
  refreshEffectivePermissions: () => Promise<string[]>;
  clearAuth: () => void;
}

const getInitialUser = (): AuthUser | null => {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem("hrms.user");
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
};

const initialUser = getInitialUser();

export const useAuthStore = create<AuthStore>((set, get) => ({
  user: initialUser,
  permissions: initialUser?.permissions || [],

  setUser: (user) => {
    if (typeof window !== "undefined") {
      if (user) {
        localStorage.setItem("hrms.user", JSON.stringify(user));
        if (user.companyName) {
          localStorage.setItem("hrms.company", JSON.stringify(user.companyName));
        }
      } else {
        localStorage.removeItem("hrms.user");
        localStorage.removeItem("hrms.company");
      }
      window.dispatchEvent(new Event("permissions-updated"));
      window.dispatchEvent(new CustomEvent("local-storage", { detail: { key: "hrms.user" } }));
    }
    set({ user, permissions: user?.permissions || [] });
  },

  setPermissions: (permissions) => {
    const current = get().user;
    if (current) {
      const updatedUser = { ...current, permissions };
      if (typeof window !== "undefined") {
        localStorage.setItem("hrms.user", JSON.stringify(updatedUser));
        window.dispatchEvent(new Event("permissions-updated"));
        window.dispatchEvent(new CustomEvent("local-storage", { detail: { key: "hrms.user" } }));
      }
      set({ user: updatedUser, permissions });
    } else {
      set({ permissions });
    }
  },

  updateUserPermissions: (permissions) => {
    get().setPermissions(permissions);
  },

  refreshEffectivePermissions: async () => {
    try {
      const { authService } = await import("../services/auth.service");
      const res = await authService.getMyPermissions();
      if (res && Array.isArray(res.permissions)) {
        get().setPermissions(res.permissions);
        return res.permissions;
      }
    } catch (err) {
      console.error("Failed to refresh effective permissions:", err);
    }
    return get().permissions;
  },

  clearAuth: () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("hrms.user");
      localStorage.removeItem("hrms.token");
      localStorage.removeItem("hrms.refreshToken");
      localStorage.removeItem("hrms.impersonator");
      localStorage.removeItem("hrms.impersonator_role");
      localStorage.removeItem("hrms.company");
      localStorage.removeItem("hrms.impersonation.originalToken");
      localStorage.removeItem("hrms.impersonation.originalRefreshToken");
      localStorage.removeItem("hrms.impersonation.originalUser");
      window.dispatchEvent(new Event("permissions-updated"));
      window.dispatchEvent(new Event("impersonation-updated"));
      window.dispatchEvent(new CustomEvent("local-storage", { detail: { key: "hrms.user" } }));
    }
    set({ user: null, permissions: [] });
  },
}));

/**
 * Custom reactive auth hook to access active user and permissions
 */
export function useAuth() {
  const user = useAuthStore((s) => s.user);
  const permissions = useAuthStore((s) => s.permissions);
  const setUser = useAuthStore((s) => s.setUser);
  const updateUserPermissions = useAuthStore((s) => s.updateUserPermissions);
  const clearAuth = useAuthStore((s) => s.clearAuth);

  return {
    user,
    permissions,
    setUser,
    updateUserPermissions,
    clearAuth,
    isAuthenticated: !!user,
  };
}

import { create } from "zustand";
import type { AuthUser } from "../types";
import { OWNER_STORAGE_KEYS } from "../config/storage";
import { clearOwnerSession } from "../api/axios";

export interface OwnerAuthState {
  user: AuthUser | null;
  permissions: string[];
  isAuthenticated: boolean;
  setUser: (user: AuthUser | null) => void;
  setPermissions: (permissions: string[]) => void;
  updateUserPermissions: (permissions: string[]) => void;
  refreshEffectivePermissions: () => Promise<string[]>;
  clearAuth: () => void;
}

const getInitialUser = (): AuthUser | null => {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem(OWNER_STORAGE_KEYS.USER);
    if (!stored) return null;
    const parsed = JSON.parse(stored);
    return parsed?.role === "SuperAdmin" ? parsed : null;
  } catch {
    return null;
  }
};

const initialUser = getInitialUser();

export const useOwnerAuthStore = create<OwnerAuthState>((set, get) => ({
  user: initialUser,
  permissions: initialUser?.permissions || [],
  isAuthenticated: !!initialUser,

  setUser: (user) => {
    if (user && user.role === "SuperAdmin") {
      if (typeof window !== "undefined") {
        localStorage.setItem(OWNER_STORAGE_KEYS.USER, JSON.stringify(user));
      }
      set({ user, permissions: user.permissions || [], isAuthenticated: true });
    } else {
      clearOwnerSession();
      set({ user: null, permissions: [], isAuthenticated: false });
    }
  },

  setPermissions: (permissions) => {
    const current = get().user;
    if (current) {
      const updatedUser = { ...current, permissions };
      if (typeof window !== "undefined") {
        localStorage.setItem(OWNER_STORAGE_KEYS.USER, JSON.stringify(updatedUser));
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
    clearOwnerSession();
    set({ user: null, permissions: [], isAuthenticated: false });
  },
}));

export const useAuthStore = useOwnerAuthStore;

export function useAuth() {
  const user = useOwnerAuthStore((s) => s.user);
  const permissions = useOwnerAuthStore((s) => s.permissions);
  const setUser = useOwnerAuthStore((s) => s.setUser);
  const updateUserPermissions = useOwnerAuthStore((s) => s.updateUserPermissions);
  const clearAuth = useOwnerAuthStore((s) => s.clearAuth);

  return {
    user,
    permissions,
    setUser,
    updateUserPermissions,
    clearAuth,
    isAuthenticated: !!user,
  };
}

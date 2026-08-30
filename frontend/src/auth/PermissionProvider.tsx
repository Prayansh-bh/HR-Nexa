import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useAuthStore } from "../store/authStore";
import { authService } from "../services/auth.service";

export interface PermissionContextValue {
  permissions: string[];
  role: string | null;
  refreshPermissions: () => Promise<void>;
  loading: boolean;
}

const PermissionContext = createContext<PermissionContextValue>({
  permissions: [],
  role: null,
  refreshPermissions: async () => {},
  loading: false,
});

export const PermissionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const user = useAuthStore((s) => s.user);
  const permissions = useAuthStore((s) => s.permissions);
  const setPermissionsInStore = useAuthStore((s) => s.setPermissions);

  const [loading, setLoading] = useState(false);
  const isRefreshingRef = React.useRef(false);
  const lastFetchTimeRef = React.useRef<number>(0);

  const refreshPermissions = useCallback(async () => {
    if (!user || isRefreshingRef.current) return;
    try {
      isRefreshingRef.current = true;
      setLoading(true);
      const res = await authService.getMyPermissions();
      if (res && Array.isArray(res.permissions)) {
        const currentPermissions = useAuthStore.getState().permissions || [];
        const isDifferent =
          res.permissions.length !== currentPermissions.length ||
          res.permissions.some((p: string, i: number) => p !== currentPermissions[i]);

        if (isDifferent) {
          setPermissionsInStore(res.permissions);
        }
      }
      lastFetchTimeRef.current = Date.now();
    } catch (err) {
      console.error("Failed to refresh session permissions:", err);
    } finally {
      setLoading(false);
      isRefreshingRef.current = false;
    }
  }, [user, setPermissionsInStore]);

  useEffect(() => {
    if (user?.id) {
      void refreshPermissions();
    }
  }, [user?.id]);

  useEffect(() => {
    const handleWindowFocus = () => {
      // Cooldown of 60 seconds for window focus permission refreshes
      const now = Date.now();
      if (now - lastFetchTimeRef.current > 60_000) {
        void refreshPermissions();
      }
    };

    if (typeof window !== "undefined") {
      window.addEventListener("focus", handleWindowFocus);
      return () => {
        window.removeEventListener("focus", handleWindowFocus);
      };
    }
  }, [refreshPermissions]);

  return (
    <PermissionContext.Provider
      value={{
        permissions,
        role: user?.role || null,
        refreshPermissions,
        loading,
      }}
    >
      {children}
    </PermissionContext.Provider>
  );
};

export function usePermissionsContext(): PermissionContextValue {
  return useContext(PermissionContext);
}

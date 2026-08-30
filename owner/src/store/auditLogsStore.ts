import { create } from "zustand";
import { notificationService } from "../services/notification.service";

export interface AuditLogRecord {
  id: string;
  userId: string | null;
  userName: string;
  action: string;
  details: string;
  timestamp: string;
}

export interface AuditLogsStore {
  auditLogs: AuditLogRecord[];
  isLoading: boolean;
  error: string | null;

  setAuditLogs: (update: AuditLogRecord[] | ((prev: AuditLogRecord[]) => AuditLogRecord[])) => void;
  fetchAuditLogs: () => Promise<void>;
  logAction: (action: string, details: string) => Promise<void>;
}

export const useAuditLogsStore = create<AuditLogsStore>()((set, get) => ({
  auditLogs: [],
  isLoading: false,
  error: null,

  setAuditLogs: (update) =>
    set((state) => ({
      auditLogs: typeof update === "function" ? update(state.auditLogs) : update,
    })),

  fetchAuditLogs: async () => {
    set({ isLoading: true, error: null });
    try {
      const res = await notificationService.getAuditLogs();
      const logs = Array.isArray(res?.data)
        ? (res.data as AuditLogRecord[])
        : Array.isArray(res)
        ? (res as AuditLogRecord[])
        : [];
      set({ auditLogs: logs, isLoading: false });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : "Failed to fetch audit logs",
        isLoading: false,
      });
    }
  },

  logAction: async (action, details) => {
    try {
      await notificationService.logAction(action, details);
      await get().fetchAuditLogs();
    } catch (err) {
      console.error("Failed to log action:", err);
    }
  },
}));

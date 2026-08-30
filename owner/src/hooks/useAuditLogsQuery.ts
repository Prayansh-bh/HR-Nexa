import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { notificationService } from "../services/notification.service";
import { realtimeEventsService } from "../services/realtimeEvents.service";
import { useUIStore } from "../store/uiStore";

export const AUDIT_LOGS_QUERY_KEYS = {
  all: ["auditLogs"] as const,
};

export function useAuditLogsQuery() {
  const companyId = useUIStore((s) => s.company) || "default";
  const query = useQuery({
    queryKey: [...AUDIT_LOGS_QUERY_KEYS.all, companyId],
    queryFn: () => notificationService.getAuditLogs(),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const rawData = query.data;
  const logs = Array.isArray(rawData)
    ? rawData
    : Array.isArray((rawData as any)?.data)
      ? (rawData as any).data
      : [];

  return {
    logs,
    records: logs,
    total: (rawData as any)?.total ?? logs.length,
    totalPages: (rawData as any)?.totalPages ?? 1,
    page: (rawData as any)?.page ?? 1,
    limit: (rawData as any)?.limit ?? 50,
    pagination: rawData,
    ...query,
  };
}

export function useAuditLogsMutations() {
  const queryClient = useQueryClient();

  const logAction = useMutation({
    mutationFn: ({ action, details }: { action: string; details: string }) =>
      notificationService.logAction(action, details),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: AUDIT_LOGS_QUERY_KEYS.all });
    },
  });

  return {
    logAction,
  };
}

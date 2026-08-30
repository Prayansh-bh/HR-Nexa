import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { notificationService } from "../services/notification.service";
import { useUIStore } from "../store";

export const AUDIT_LOGS_QUERY_KEYS = {
  all: ["auditLogs"] as const,
};

export function useAuditLogsQuery() {
  const companyId = useUIStore((s) => s.company) || "default";
  return useQuery({
    queryKey: [...AUDIT_LOGS_QUERY_KEYS.all, companyId],
    queryFn: () => notificationService.getAuditLogs(),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
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

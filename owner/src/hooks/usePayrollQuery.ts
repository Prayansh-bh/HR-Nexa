import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { payrollService } from "../services/payroll.service";
import { realtimeEventsService } from "../services/realtimeEvents.service";
import { useAuthStore } from "../store/authStore";

export const PAYROLL_QUERY_KEYS = {
  all: ["payroll"] as const,
};

export function usePayrollQuery(month?: string, employeeId?: string) {
  const user = useAuthStore((s) => s.user);
  const companyId = user?.companyId ?? null;

  const query = useQuery({
    queryKey: [...PAYROLL_QUERY_KEYS.all, companyId || "default", month, employeeId],
    queryFn: () => payrollService.getPayroll(month, employeeId),
    enabled: Boolean(companyId || user?.role === "SuperAdmin"),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const rawData = query.data;
  const slips = Array.isArray(rawData)
    ? rawData
    : Array.isArray((rawData as any)?.data)
      ? (rawData as any).data
      : [];

  return {
    slips,
    records: slips,
    total: (rawData as any)?.total ?? slips.length,
    totalPages: (rawData as any)?.totalPages ?? 1,
    page: (rawData as any)?.page ?? 1,
    limit: (rawData as any)?.limit ?? 50,
    pagination: rawData,
    ...query,
  };
}

export function usePayrollMutations() {
  const queryClient = useQueryClient();

  const processPayroll = useMutation({
    mutationFn: (record: any) => payrollService.processPayroll(record),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PAYROLL_QUERY_KEYS.all });
      queryClient.invalidateQueries({ queryKey: ["subscriptionStats"] });
    },
  });

  const updatePayrollStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "Draft" | "Processed" | "Paid" }) =>
      payrollService.updatePayrollStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PAYROLL_QUERY_KEYS.all });
    },
  });

  return {
    processPayroll,
    updatePayrollStatus,
  };
}

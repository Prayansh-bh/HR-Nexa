import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { payrollService } from "../services/payroll.service";
import { realtimeEventsService } from "../services/realtimeEvents.service";
import { useAuthStore } from "../store/authStore";
import { useHasPermission } from "../auth/useHasPermission";
import { PERMISSIONS } from "../auth/permissions";

export const PAYROLL_QUERY_KEYS = {
  all: ["payroll"] as const,
};

export function usePayrollQuery(
  month?: string,
  employeeId?: string,
  params?: { page?: number; limit?: number },
) {
  const user = useAuthStore((s) => s.user);
  const companyId = user?.companyId ?? null;

  const query = useQuery({
    queryKey: [...PAYROLL_QUERY_KEYS.all, companyId || "default", month, employeeId, params],
    queryFn: () => payrollService.getPayroll(month, employeeId, params),
    enabled: Boolean(companyId || user?.role === "SuperAdmin"),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const slips = Array.isArray(query.data)
    ? query.data
    : Array.isArray(query.data?.data)
    ? query.data.data
    : [];

  return {
    ...query,
    slips,
    records: slips,
    total: query.data?.total ?? slips.length,
    page: query.data?.page ?? params?.page ?? 1,
    limit: query.data?.limit ?? params?.limit ?? 50,
    totalPages: query.data?.totalPages ?? (slips.length > 0 ? 1 : 0),
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

export function usePayrollInputsQuery(month?: string, employeeId?: string) {
  const user = useAuthStore((s) => s.user);
  const companyId = user?.companyId ?? null;
  const isSuperAdmin = user?.role === "SuperAdmin";
  const hasPayrollView = useHasPermission(PERMISSIONS.PAYROLL_PROCESS_VIEW);

  return useQuery({
    queryKey: [...PAYROLL_QUERY_KEYS.all, "inputs", companyId || "default", month, employeeId],
    queryFn: () => payrollService.getPayrollInputs(month, employeeId),
    enabled: Boolean(month && (companyId || isSuperAdmin) && (hasPayrollView || isSuperAdmin)),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}

export function usePayrollInputsMutations() {
  const queryClient = useQueryClient();

  const updatePayrollInput = useMutation({
    mutationFn: ({
      employeeId,
      payload,
    }: {
      employeeId: string;
      payload: {
        month: string;
        lopDays?: number;
        overtimeHours?: number;
        bonus?: number;
        deductions?: number;
        remarks?: string;
      };
    }) => payrollService.updatePayrollInput(employeeId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [...PAYROLL_QUERY_KEYS.all, "inputs"],
      });
      queryClient.invalidateQueries({
        queryKey: PAYROLL_QUERY_KEYS.all,
      });
    },
  });

  return {
    updatePayrollInput,
  };
}

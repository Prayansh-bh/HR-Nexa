import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { employeeService } from "../services/employee.service";
import { realtimeEventsService } from "../services/realtimeEvents.service";
import { employeeSyncService } from "../services/employee-sync.service";
import type { Employee, OrgChartEmployee } from "../types";
import { useAuthStore } from "../store/authStore";

export const EMPLOYEE_QUERY_KEYS = {
  all: ["employees"] as const,
  orgchart: ["employees", "orgchart"] as const,
  detail: ["employees", "detail"] as const,
};

export function useEmployeesQuery() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const companyId = user?.companyId ?? null;

  useEffect(() => {
    return employeeSyncService.subscribe(() => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
    });
  }, [queryClient]);

  return useQuery<Employee[]>({
    queryKey: [...EMPLOYEE_QUERY_KEYS.all, companyId || "default"],
    queryFn: async () => {
      const data = await employeeService.getEmployees();
      return Array.isArray(data) ? data : [];
    },
    enabled: Boolean(companyId || user?.role === "SuperAdmin"),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  });
}

export function useOrgChartQuery() {
  const user = useAuthStore((s) => s.user);
  const companyId = user?.companyId ?? null;

  return useQuery<OrgChartEmployee[]>({
    queryKey: [...EMPLOYEE_QUERY_KEYS.orgchart, companyId || "default"],
    queryFn: async () => {
      const data = await employeeService.getOrgChart();
      return Array.isArray(data) ? data : [];
    },
    enabled: Boolean(companyId || user?.role === "SuperAdmin"),
    staleTime: 30_000,
  });
}

export function useEmployeeMutations() {
  const queryClient = useQueryClient();

  const createEmployee = useMutation({
    mutationFn: (data: any) => employeeService.createEmployee(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: EMPLOYEE_QUERY_KEYS.all });
      queryClient.invalidateQueries({ queryKey: ["companies"] });
      queryClient.invalidateQueries({ queryKey: ["subscriptionStats"] });
    },
  });

  const updateEmployee = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      employeeService.updateEmployee(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: EMPLOYEE_QUERY_KEYS.all });
    },
  });

  const deleteEmployee = useMutation({
    mutationFn: (id: string) => employeeService.deleteEmployee(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: EMPLOYEE_QUERY_KEYS.all });
      queryClient.invalidateQueries({ queryKey: ["companies"] });
      queryClient.invalidateQueries({ queryKey: ["subscriptionStats"] });
    },
  });

  return {
    createEmployee,
    updateEmployee,
    deleteEmployee,
  };
}

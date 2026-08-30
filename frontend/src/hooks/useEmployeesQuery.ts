import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { employeeService, EmployeeQueryParams } from "../services/employee.service";
import { realtimeEventsService } from "../services/realtimeEvents.service";
import { employeeSyncService } from "../services/employee-sync.service";
import type { Employee, OrgChartEmployee } from "../types";
import { PaginatedResponse } from "../types/pagination";
import { useAuthStore } from "../store/authStore";
import { useHasPermission } from "../auth/useHasPermission";
import { PERMISSIONS } from "../auth/permissions";

export const EMPLOYEE_QUERY_KEYS = {
  all: ["employees"] as const,
  orgchart: ["employees", "orgchart"] as const,
  detail: ["employees", "detail"] as const,
};

export function useEmployeesQuery(params?: EmployeeQueryParams) {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const companyId = user?.companyId ?? null;
  const isSuperAdmin = user?.role === "SuperAdmin";
  const effectiveTenantKey = companyId || (isSuperAdmin ? "global" : "unauthenticated");
  const hasListView = useHasPermission(PERMISSIONS.EMPLOYEES_LIST_VIEW);

  useEffect(() => {
    return employeeSyncService.subscribe(() => {
      queryClient.invalidateQueries({ queryKey: EMPLOYEE_QUERY_KEYS.all });
    });
  }, [queryClient]);

  const query = useQuery<PaginatedResponse<Employee>>({
    queryKey: [...EMPLOYEE_QUERY_KEYS.all, effectiveTenantKey, params],
    queryFn: async () => {
      return employeeService.getEmployees(params);
    },
    enabled: Boolean((companyId || isSuperAdmin) && hasListView),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  });

  const rawData = query.data;
  const employees: Employee[] = Array.isArray(rawData)
    ? rawData
    : (rawData && Array.isArray((rawData as any).data) ? (rawData as any).data : []);
  const total = typeof rawData?.total === "number" ? rawData.total : employees.length;
  const page = typeof rawData?.page === "number" ? rawData.page : (params?.page || 1);
  const limit = typeof rawData?.limit === "number" ? rawData.limit : (params?.limit || 50);
  const totalPages = typeof rawData?.totalPages === "number" ? rawData.totalPages : (total > 0 ? Math.ceil(total / limit) : 0);

  return {
    ...query,
    data: rawData,
    employees,
    total,
    totalPages,
    page,
    limit,
    pagination: rawData,
  };
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
      employeeSyncService.notifyEmployeeChange();
    },
  });

  const updateEmployee = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      employeeService.updateEmployee(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: EMPLOYEE_QUERY_KEYS.all });
      employeeSyncService.notifyEmployeeChange();
    },
  });

  const deleteEmployee = useMutation({
    mutationFn: (id: string) => employeeService.deleteEmployee(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: EMPLOYEE_QUERY_KEYS.all });
      queryClient.invalidateQueries({ queryKey: ["companies"] });
      queryClient.invalidateQueries({ queryKey: ["subscriptionStats"] });
      employeeSyncService.notifyEmployeeChange();
    },
  });

  return {
    createEmployee,
    updateEmployee,
    deleteEmployee,
  };
}

export function useEmployeeQuery(id?: string | null) {
  const user = useAuthStore((s) => s.user);
  const companyId = user?.companyId ?? null;
  const hasProfileView = useHasPermission(PERMISSIONS.EMPLOYEES_PROFILE_VIEW);

  return useQuery<Employee>({
    queryKey: [...EMPLOYEE_QUERY_KEYS.detail, id],
    queryFn: () => employeeService.getEmployee(id!),
    enabled: Boolean(id && (companyId || user?.role === "SuperAdmin") && hasProfileView),
    staleTime: 30_000,
  });
}

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { departmentService } from "../services/department.service";
import { designationService } from "../services/designation.service";
import { attendanceService } from "../services/attendance.service";
import { leaveService } from "../services/leave.service";
import { realtimeEventsService } from "../services/realtimeEvents.service";
import { resolveDepartments, resolveDesignations } from "../helpers/departmentDesignationHelper";
import { useEmployeesQuery } from "./useEmployeesQuery";
import { useUIStore } from "../store/uiStore";
import { useAuthStore } from "../store/authStore";
import { hasPermission, isSuperAdmin } from "../auth/authorization";
import type { Employee } from "../types";

export const ORG_QUERY_KEYS = {
  departments: ["departments"] as const,
  designations: ["designations"] as const,
  devices: ["devices"] as const,
  zones: ["zones"] as const,
  leaveTypes: ["leaveTypes"] as const,
};

export function useDepartmentsQuery() {
  const { data: employeesData, employees: employeesProp } = useEmployeesQuery();
  const employees: Employee[] = Array.isArray(employeesProp) && employeesProp.length > 0
    ? employeesProp
    : (Array.isArray(employeesData)
        ? employeesData
        : (employeesData && Array.isArray((employeesData as any).data) ? (employeesData as any).data : (Array.isArray(employeesProp) ? employeesProp : [])));
  const user = useAuthStore((s) => s.user);
  const companyId = user?.companyId || useUIStore.getState().company || "default";

  return useQuery({
    queryKey: [...ORG_QUERY_KEYS.departments, companyId, employees],
    queryFn: async () => {
      const data = await departmentService.getDepartments();
      return resolveDepartments(Array.isArray(data) ? data : null, employees);
    },
    enabled: Boolean(companyId || user?.role === "SuperAdmin"),
    staleTime: 60_000,
  });
}

export function useDesignationsQuery() {
  const { data: employeesData, employees: employeesProp } = useEmployeesQuery();
  const employees: Employee[] = Array.isArray(employeesProp) && employeesProp.length > 0
    ? employeesProp
    : (Array.isArray(employeesData)
        ? employeesData
        : (employeesData && Array.isArray((employeesData as any).data) ? (employeesData as any).data : (Array.isArray(employeesProp) ? employeesProp : [])));
  const user = useAuthStore((s) => s.user);
  const companyId = user?.companyId || useUIStore.getState().company || "default";

  return useQuery({
    queryKey: [...ORG_QUERY_KEYS.designations, companyId, employees],
    queryFn: async () => {
      const data = await designationService.getDesignations();
      return resolveDesignations(Array.isArray(data) ? data : null, employees);
    },
    enabled: Boolean(companyId || user?.role === "SuperAdmin"),
    staleTime: 60_000,
  });
}

export function useDevicesQuery() {
  const user = useAuthStore((s) => s.user);
  const companyId = user?.companyId || useUIStore.getState().company || "default";
  const canAccessDevices =
    isSuperAdmin(user) ||
    hasPermission(user, "attendance:devices:manage") ||
    hasPermission(user, "attendance:devices:sync");

  return useQuery({
    queryKey: [...ORG_QUERY_KEYS.devices, companyId],
    queryFn: () => attendanceService.getDevices(),
    enabled: Boolean((companyId || isSuperAdmin(user)) && canAccessDevices),
    staleTime: 30_000,
  });
}

export function useZonesQuery() {
  const user = useAuthStore((s) => s.user);
  const companyId = user?.companyId || useUIStore.getState().company || "default";
  const canAccessZones =
    isSuperAdmin(user) ||
    hasPermission(user, "attendance:geo:config");

  return useQuery({
    queryKey: [...ORG_QUERY_KEYS.zones, companyId],
    queryFn: () => attendanceService.getZones(),
    enabled: Boolean((companyId || isSuperAdmin(user)) && canAccessZones),
    staleTime: 30_000,
  });
}

export function useOrgMutations() {
  const queryClient = useQueryClient();

  const createDepartment = useMutation({
    mutationFn: ({ name, head }: { name: string; head?: string }) =>
      departmentService.createDepartment(name, head),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ORG_QUERY_KEYS.departments });
    },
  });

  const deleteDepartment = useMutation({
    mutationFn: (id: string) => departmentService.deleteDepartment(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ORG_QUERY_KEYS.departments });
    },
  });

  const createDesignation = useMutation({
    mutationFn: ({ name, band }: { name: string; band: string }) =>
      designationService.createDesignation(name, band),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ORG_QUERY_KEYS.designations });
    },
  });

  const deleteDesignation = useMutation({
    mutationFn: (id: string) => designationService.deleteDesignation(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ORG_QUERY_KEYS.designations });
    },
  });

  const createDevice = useMutation({
    mutationFn: ({ name, ip }: { name: string; ip: string }) =>
      attendanceService.createDevice({ name, ip }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ORG_QUERY_KEYS.devices });
    },
  });

  const deleteDevice = useMutation({
    mutationFn: (id: string) => attendanceService.deleteDevice(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ORG_QUERY_KEYS.devices });
    },
  });

  const syncDevice = useMutation({
    mutationFn: (id: string) => attendanceService.syncDevice(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ORG_QUERY_KEYS.devices });
    },
  });

  const createZone = useMutation({
    mutationFn: (payload: {
      name: string;
      latitude: number;
      longitude: number;
      radiusMeters: number;
      address?: string;
      enabled?: boolean;
    }) => attendanceService.createZone(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ORG_QUERY_KEYS.zones });
    },
  });

  const updateZone = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      attendanceService.updateZone(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ORG_QUERY_KEYS.zones });
    },
  });

  const deleteZone = useMutation({
    mutationFn: (id: string) => attendanceService.deleteZone(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ORG_QUERY_KEYS.zones });
    },
  });

  return {
    createDepartment,
    deleteDepartment,
    createDesignation,
    deleteDesignation,
    createDevice,
    deleteDevice,
    syncDevice,
    createZone,
    updateZone,
    deleteZone,
  };
}

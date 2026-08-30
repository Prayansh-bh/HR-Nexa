import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { leaveService } from "../services/leave.service";
import { realtimeEventsService } from "../services/realtimeEvents.service";
import { useAuthStore } from "../store/authStore";
import { useHasPermission } from "../auth/useHasPermission";
import { PERMISSIONS } from "../auth/permissions";

import type { LeaveRequest } from "../types";

export const LEAVE_QUERY_KEYS = {
  all: ["leaves"] as const,
  types: ["leaveTypes"] as const,
  events: ["leaveEvents"] as const,
};

export interface UseLeavesQueryOptions {
  employeeId?: string;
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export function useLeavesQuery(
  optionsOrEmployeeId?: string | UseLeavesQueryOptions,
  status?: string,
) {
  const user = useAuthStore((s) => s.user);
  const companyId = user?.companyId ?? null;
  const isSuperAdmin = user?.role === "SuperAdmin";
  const hasRequestsView = useHasPermission(
    [PERMISSIONS.LEAVES_REQUESTS_VIEW, PERMISSIONS.LEAVES_VIEW, PERMISSIONS.LEAVES_REQUESTS_APPROVE],
    "any",
  );

  const normalizedOptions: UseLeavesQueryOptions =
    typeof optionsOrEmployeeId === "object" && optionsOrEmployeeId !== null
      ? optionsOrEmployeeId
      : {
          employeeId: optionsOrEmployeeId,
          status,
        };

  const query = useQuery({
    queryKey: [...LEAVE_QUERY_KEYS.all, companyId || "default", normalizedOptions],
    queryFn: () => leaveService.getLeaves(normalizedOptions),
    enabled: Boolean((companyId || isSuperAdmin) && (hasRequestsView || isSuperAdmin)),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const rawData: any = query.data;
  const leaves: LeaveRequest[] = Array.isArray(rawData)
    ? rawData
    : rawData && Array.isArray(rawData.data)
      ? rawData.data
      : [];

  const total = typeof rawData?.total === "number" ? rawData.total : leaves.length;
  const page = typeof rawData?.page === "number" ? rawData.page : (normalizedOptions.page || 1);
  const limit = typeof rawData?.limit === "number" ? rawData.limit : (normalizedOptions.limit || 50);
  const totalPages =
    typeof rawData?.totalPages === "number"
      ? rawData.totalPages
      : total > 0
        ? Math.ceil(total / limit)
        : 0;

  return {
    ...query,
    data: rawData,
    leaves,
    total,
    totalPages,
    page,
    limit,
    pagination: {
      total,
      page,
      limit,
      totalPages,
    },
  };
}

export function useLeaveTypesQuery() {
  const user = useAuthStore((s) => s.user);
  const companyId = user?.companyId ?? null;
  const isSuperAdmin = user?.role === "SuperAdmin";
  const hasPolicyManage = useHasPermission(PERMISSIONS.LEAVES_POLICY_MANAGE);

  return useQuery({
    queryKey: [...LEAVE_QUERY_KEYS.types, companyId || "default"],
    queryFn: () => leaveService.getLeaveTypes(),
    enabled: Boolean((companyId || isSuperAdmin) && (hasPolicyManage || isSuperAdmin)),
    staleTime: 60_000,
  });
}

export function useLeaveEventsQuery() {
  const user = useAuthStore((s) => s.user);
  const companyId = user?.companyId ?? null;
  const isSuperAdmin = user?.role === "SuperAdmin";
  const hasRequestsView = useHasPermission(PERMISSIONS.LEAVES_REQUESTS_VIEW);

  return useQuery({
    queryKey: [...LEAVE_QUERY_KEYS.events, companyId || "default"],
    queryFn: () => leaveService.getEvents(),
    enabled: Boolean((companyId || isSuperAdmin) && (hasRequestsView || isSuperAdmin)),
    staleTime: 30_000,
  });
}

export function useLeaveQuotaQuery(employeeId?: string) {
  const user = useAuthStore((s) => s.user);
  const companyId = user?.companyId ?? null;

  return useQuery({
    queryKey: ["leaveQuota", companyId || "default", employeeId],
    queryFn: () => (employeeId ? leaveService.getLeaveQuota(employeeId) : Promise.resolve([])),
    enabled: Boolean(employeeId && (companyId || user?.role === "SuperAdmin")),
    staleTime: 30_000,
  });
}

export function useLeaveMutations() {
  const queryClient = useQueryClient();

  const createLeave = useMutation({
    mutationFn: (data: any) => leaveService.createLeave(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: LEAVE_QUERY_KEYS.all });
    },
  });

  const updateLeaveStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "Approved" | "Rejected" }) =>
      leaveService.updateLeaveStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: LEAVE_QUERY_KEYS.all });
    },
  });

  const createEvent = useMutation({
    mutationFn: (eventData: any) => leaveService.createEvent(eventData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: LEAVE_QUERY_KEYS.events });
    },
  });

  const createLeaveType = useMutation({
    mutationFn: (data: any) => leaveService.createLeaveType(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: LEAVE_QUERY_KEYS.types });
    },
  });

  const updateLeaveType = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => leaveService.updateLeaveType(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: LEAVE_QUERY_KEYS.types });
    },
  });

  const deleteLeaveType = useMutation({
    mutationFn: (id: string) => leaveService.deleteLeaveType(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: LEAVE_QUERY_KEYS.types });
    },
  });

  const deleteEvent = useMutation({
    mutationFn: (id: string) => leaveService.deleteEvent(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: LEAVE_QUERY_KEYS.events });
    },
  });

  return {
    createLeave,
    updateLeaveStatus,
    createEvent,
    createLeaveType,
    updateLeaveType,
    deleteLeaveType,
    deleteEvent,
  };
}

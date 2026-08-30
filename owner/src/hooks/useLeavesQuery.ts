import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { leaveService } from "../services/leave.service";
import { realtimeEventsService } from "../services/realtimeEvents.service";
import { useAuthStore } from "../store/authStore";

export const LEAVE_QUERY_KEYS = {
  all: ["leaves"] as const,
  types: ["leaveTypes"] as const,
  events: ["leaveEvents"] as const,
};

export function useLeavesQuery(employeeId?: string, status?: string) {
  const user = useAuthStore((s) => s.user);
  const companyId = user?.companyId ?? null;

  return useQuery({
    queryKey: [...LEAVE_QUERY_KEYS.all, companyId || "default", employeeId, status],
    queryFn: () => leaveService.getLeaves(employeeId, status),
    enabled: Boolean(companyId || user?.role === "SuperAdmin"),
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  });
}

export function useLeaveTypesQuery() {
  const user = useAuthStore((s) => s.user);
  const companyId = user?.companyId ?? null;

  return useQuery({
    queryKey: [...LEAVE_QUERY_KEYS.types, companyId || "default"],
    queryFn: () => leaveService.getLeaveTypes(),
    enabled: Boolean(companyId || user?.role === "SuperAdmin"),
    staleTime: 60_000,
  });
}

export function useLeaveEventsQuery() {
  const user = useAuthStore((s) => s.user);
  const companyId = user?.companyId ?? null;

  return useQuery({
    queryKey: [...LEAVE_QUERY_KEYS.events, companyId || "default"],
    queryFn: () => leaveService.getEvents(),
    enabled: Boolean(companyId || user?.role === "SuperAdmin"),
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

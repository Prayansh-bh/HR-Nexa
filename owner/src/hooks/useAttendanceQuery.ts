import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { attendanceService } from "../services/attendance.service";
import { realtimeEventsService } from "../services/realtimeEvents.service";
import type { AttendanceRecord, ClockInOutPayload } from "../types/attendance";
import { useAuthStore } from "../store/authStore";

export const ATTENDANCE_QUERY_KEYS = {
  all: ["attendance"] as const,
  matrix: ["attendance-matrix"] as const,
  detail: ["attendance", "detail"] as const,
  settings: ["attendance", "settings"] as const,
  requests: ["attendance", "regularize-requests"] as const,
};

export function useAttendanceSettingsQuery() {
  const user = useAuthStore((s) => s.user);
  const companyId = user?.companyId ?? null;

  return useQuery({
    queryKey: [...ATTENDANCE_QUERY_KEYS.settings, companyId || "default"],
    queryFn: () => attendanceService.getSettings(),
    staleTime: 60_000,
  });
}

export function useRegularizationRequestsQuery(params?: {
  status?: string;
  employeeId?: string;
  page?: number;
  limit?: number;
}) {
  const user = useAuthStore((s) => s.user);
  const companyId = user?.companyId ?? null;

  return useQuery({
    queryKey: [...ATTENDANCE_QUERY_KEYS.requests, companyId || "default", params],
    queryFn: () => attendanceService.getRegularizationRequests(params),
    enabled: Boolean(companyId || user?.role === "SuperAdmin" || user?.role === "Employee"),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}

export function useAttendanceQuery(params?: {
  employeeId?: string;
  date?: string;
  status?: string;
}) {
  const user = useAuthStore((s) => s.user);
  const companyId = user?.companyId ?? null;

  return useQuery<AttendanceRecord[]>({
    queryKey: [...ATTENDANCE_QUERY_KEYS.all, companyId || "default", params],
    queryFn: async () => {
      const res = await attendanceService.getAttendance(
        params?.employeeId,
        params?.date,
        params?.status,
      );
      if (Array.isArray(res)) return res;
      if (res && Array.isArray((res as any).data)) return (res as any).data;
      return [];
    },
    enabled: Boolean(companyId || user?.role === "SuperAdmin"),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  });
}

export function useAttendanceMatrixQuery(month: string, department?: string, search?: string) {
  const user = useAuthStore((s) => s.user);
  const companyId = user?.companyId ?? null;

  return useQuery({
    queryKey: [...ATTENDANCE_QUERY_KEYS.matrix, companyId || "default", month, department, search],
    queryFn: () => attendanceService.getMatrix(month, department, search),
    enabled: Boolean(companyId || user?.role === "SuperAdmin"),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}

export function useAttendanceMutations() {
  const queryClient = useQueryClient();

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ATTENDANCE_QUERY_KEYS.all });
    queryClient.invalidateQueries({ queryKey: ATTENDANCE_QUERY_KEYS.matrix });
    queryClient.invalidateQueries({ queryKey: ATTENDANCE_QUERY_KEYS.requests });
  };

  const clockInOrOut = useMutation({
    mutationFn: (data: ClockInOutPayload) => attendanceService.clockInOut(data),
    onSuccess: invalidateAll,
  });

  const regularize = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => attendanceService.regularize(id, data),
    onSuccess: invalidateAll,
  });

  const createRegularizationRequest = useMutation({
    mutationFn: (data: {
      attendanceId: string;
      requestedInTime: string;
      requestedOutTime: string;
      reason: string;
    }) => attendanceService.requestRegularization(data),
    onSuccess: invalidateAll,
  });

  const verify = useMutation({
    mutationFn: (id: string) => attendanceService.verify(id),
    onSuccess: invalidateAll,
  });

  const approveRegularizationRequest = useMutation({
    mutationFn: ({ id, reviewerRemark }: { id: string; reviewerRemark?: string }) =>
      attendanceService.approveRegularizationRequest(id, reviewerRemark),
    onSuccess: invalidateAll,
  });

  const rejectRegularizationRequest = useMutation({
    mutationFn: ({ id, reviewerRemark }: { id: string; reviewerRemark: string }) =>
      attendanceService.rejectRegularizationRequest(id, reviewerRemark),
    onSuccess: invalidateAll,
  });

  return {
    clockInOrOut,
    regularize,
    createRegularizationRequest,
    approveRegularizationRequest,
    rejectRegularizationRequest,
    verify,
  };
}

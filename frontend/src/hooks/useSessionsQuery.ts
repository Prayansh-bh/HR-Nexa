import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { authService } from "../services/auth.service";
import { useAuthStore } from "../store/authStore";

export interface UserSession {
  id: string;
  ipAddress?: string;
  userAgent?: string;
  device?: string;
  location?: string;
  isCurrent?: boolean;
  createdAt: string;
  lastActiveAt?: string;
}

export function useSessionsQuery() {
  const user = useAuthStore((s) => s.user);
  const userId = user?.id ?? null;

  return useQuery<UserSession[]>({
    queryKey: ["user-sessions", userId || "anonymous"],
    queryFn: async () => {
      const data = await authService.getSessions();
      return data || [];
    },
    enabled: Boolean(userId),
    staleTime: 30_000,
  });
}

export function useRevokeSessionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: string) => authService.revokeSession(sessionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-sessions"] });
    },
  });
}

export function useRevokeOtherSessionsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => authService.revokeOtherSessions(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-sessions"] });
    },
  });
}

export function useRevokeAllSessionsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId?: string) => authService.revokeAllSessions(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-sessions"] });
    },
  });
}

export function useChangePasswordMutation() {
  return useMutation({
    mutationFn: (dto: { oldPassword?: string; currentPassword?: string; newPassword?: string; pass?: string }) =>
      authService.changePassword(dto),
  });
}

export function useVerifyEmailMutation() {
  return useMutation({
    mutationFn: (token: string) => authService.verifyEmail(token),
  });
}

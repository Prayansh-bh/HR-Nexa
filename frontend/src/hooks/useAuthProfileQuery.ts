import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { authService } from "../services/auth.service";

export const AUTH_PROFILE_QUERY_KEY = ["authProfile"] as const;

export function useAuthProfileQuery() {
  return useQuery({
    queryKey: AUTH_PROFILE_QUERY_KEY,
    queryFn: () => authService.getProfile(),
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: true,
  });
}

export function useAuthMutations() {
  const queryClient = useQueryClient();

  const logout = useMutation({
    mutationFn: () => authService.logout(),
    onSuccess: () => {
      queryClient.clear();
      localStorage.removeItem("hrms.token");
      localStorage.removeItem("hrms.user");
      window.location.href = "/login";
    },
  });

  return { logout };
}

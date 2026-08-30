import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { usersService, UserAccount } from "../services/users.service";

export const USER_QUERY_KEYS = {
  all: ["users"] as const,
  list: (params?: any) => ["users", params] as const,
};

export function useUsersQuery(params?: any) {
  return useQuery<UserAccount[]>({
    queryKey: USER_QUERY_KEYS.list(params),
    queryFn: async () => {
      const res = await usersService.getAllUsers(params);
      const list = Array.isArray(res) ? res : (res as any)?.data || [];
      return list as UserAccount[];
    },
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  });
}

export function useUserMutations() {
  const queryClient = useQueryClient();

  const updateUser = useMutation({
    mutationFn: ({ id, role, status }: { id: string; role: string; status: string }) =>
      usersService.updateUser(id, role, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: USER_QUERY_KEYS.all });
    },
  });

  const createUser = useMutation({
    mutationFn: (userData: any) => usersService.createUser(userData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: USER_QUERY_KEYS.all });
    },
  });

  const forceLogout = useMutation({
    mutationFn: (id: string) => usersService.forceLogout(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: USER_QUERY_KEYS.all });
    },
  });

  const deleteUser = useMutation({
    mutationFn: (id: string) => usersService.deleteUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: USER_QUERY_KEYS.all });
    },
  });

  return {
    updateUser,
    createUser,
    forceLogout,
    deleteUser,
  };
}

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { dprService } from "../services/dpr.service";
import { useAuthStore } from "../store/authStore";

export const DPR_QUERY_KEYS = {
  all: ["dpr"] as const,
  myHistory: () => [...DPR_QUERY_KEYS.all, "my", "history"] as const,
  myDetail: (id: string) => [...DPR_QUERY_KEYS.all, "my", "detail", id] as const,
  teamList: (filters?: any) => [...DPR_QUERY_KEYS.all, "team", "list", filters] as const,
  teamDetail: (id: string) => [...DPR_QUERY_KEYS.all, "team", "detail", id] as const,
};

export function useMyDprHistoryQuery() {
  const user = useAuthStore((s) => s.user);
  const companyId = user?.companyId ?? null;

  return useQuery({
    queryKey: DPR_QUERY_KEYS.myHistory(),
    queryFn: () => dprService.getMyHistory(),
    enabled: Boolean(companyId),
    staleTime: 10_000,
  });
}

export function useMyDprDetailsQuery(id: string) {
  const user = useAuthStore((s) => s.user);
  const companyId = user?.companyId ?? null;

  return useQuery({
    queryKey: DPR_QUERY_KEYS.myDetail(id),
    queryFn: () => dprService.getMyDprById(id),
    enabled: Boolean(companyId && id),
    staleTime: 10_000,
  });
}

export function useDprMutations() {
  const queryClient = useQueryClient();

  const createDpr = useMutation({
    mutationFn: (payload: any) => dprService.createMyDpr(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: DPR_QUERY_KEYS.all });
    },
  });

  const updateDpr = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: any }) =>
      dprService.updateMyDpr(id, payload),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: DPR_QUERY_KEYS.all });
      queryClient.invalidateQueries({ queryKey: DPR_QUERY_KEYS.myDetail(variables.id) });
    },
  });

  const submitDpr = useMutation({
    mutationFn: (id: string) => dprService.submitMyDpr(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: DPR_QUERY_KEYS.all });
      queryClient.invalidateQueries({ queryKey: DPR_QUERY_KEYS.myDetail(id) });
    },
  });

  return {
    createDpr,
    updateDpr,
    submitDpr,
  };
}

export function useTeamDprsQuery(filters?: {
  employeeId?: string;
  reportDate?: string;
  status?: string;
}) {
  const user = useAuthStore((s) => s.user);
  const companyId = user?.companyId ?? null;

  return useQuery({
    queryKey: DPR_QUERY_KEYS.teamList(filters),
    queryFn: () => dprService.getTeamReports(filters),
    enabled: Boolean(companyId),
    staleTime: 10_000,
  });
}

export function useTeamDprDetailsQuery(id: string) {
  const user = useAuthStore((s) => s.user);
  const companyId = user?.companyId ?? null;

  return useQuery({
    queryKey: DPR_QUERY_KEYS.teamDetail(id),
    queryFn: () => dprService.getTeamDprById(id),
    enabled: Boolean(companyId && id),
    staleTime: 10_000,
  });
}

export function useReviewDprMutations() {
  const queryClient = useQueryClient();

  const approveDpr = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload?: { reviewerRemark?: string } }) =>
      dprService.approveReport(id, payload),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: DPR_QUERY_KEYS.all });
      queryClient.invalidateQueries({ queryKey: DPR_QUERY_KEYS.teamDetail(variables.id) });
    },
  });

  const rejectDpr = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload?: { reviewerRemark?: string } }) =>
      dprService.rejectReport(id, payload),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: DPR_QUERY_KEYS.all });
      queryClient.invalidateQueries({ queryKey: DPR_QUERY_KEYS.teamDetail(variables.id) });
    },
  });

  const requestCorrectionDpr = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload?: { reviewerRemark?: string } }) =>
      dprService.correctionRequiredReport(id, payload),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: DPR_QUERY_KEYS.all });
      queryClient.invalidateQueries({ queryKey: DPR_QUERY_KEYS.teamDetail(variables.id) });
    },
  });

  return {
    approveDpr,
    rejectDpr,
    requestCorrectionDpr,
  };
}

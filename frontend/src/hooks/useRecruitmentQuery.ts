import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { recruitmentService, EvaluationData } from "../services/recruitment.service";
import { useUIStore } from "../store/uiStore";

export const RECRUITMENT_QUERY_KEYS = {
  requisitions: ["requisitions"] as const,
  candidates: ["candidates"] as const,
  evaluation: (id: string) => ["candidateEvaluation", id] as const,
};

export function useRequisitionsQuery(params?: { page?: number; limit?: number }) {
  const companyId = useUIStore((s) => s.company) || "default";
  const query = useQuery({
    queryKey: [...RECRUITMENT_QUERY_KEYS.requisitions, companyId, params],
    queryFn: () => recruitmentService.getJobPostings(params),
    staleTime: 30_000,
  });

  const requisitions = Array.isArray(query.data)
    ? query.data
    : Array.isArray(query.data?.data)
    ? query.data.data
    : [];

  return {
    ...query,
    requisitions,
    total: query.data?.total ?? requisitions.length,
    page: query.data?.page ?? params?.page ?? 1,
    limit: query.data?.limit ?? params?.limit ?? 50,
    totalPages: query.data?.totalPages ?? (requisitions.length > 0 ? 1 : 0),
  };
}

export function useCandidatesQuery(params?: { page?: number; limit?: number; jobId?: string }) {
  const companyId = useUIStore((s) => s.company) || "default";
  const query = useQuery({
    queryKey: [...RECRUITMENT_QUERY_KEYS.candidates, companyId, params],
    queryFn: () => recruitmentService.getCandidates(params),
    staleTime: 30_000,
  });

  const candidates = Array.isArray(query.data)
    ? query.data
    : Array.isArray(query.data?.data)
    ? query.data.data
    : [];

  return {
    ...query,
    candidates,
    total: query.data?.total ?? candidates.length,
    page: query.data?.page ?? params?.page ?? 1,
    limit: query.data?.limit ?? params?.limit ?? 50,
    totalPages: query.data?.totalPages ?? (candidates.length > 0 ? 1 : 0),
  };
}

export function useRecruitmentMutations() {
  const queryClient = useQueryClient();

  const createRequisition = useMutation({
    mutationFn: (data: any) => recruitmentService.createJobPosting(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: RECRUITMENT_QUERY_KEYS.requisitions });
    },
  });

  const updateCandidateStage = useMutation({
    mutationFn: ({ id, stage }: { id: string; stage: string }) =>
      recruitmentService.updateCandidateStage(id, stage),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: RECRUITMENT_QUERY_KEYS.candidates });
    },
  });

  const submitEvaluation = useMutation({
    mutationFn: ({ candidateId, data }: { candidateId: string; data: EvaluationData }) =>
      recruitmentService.submitEvaluation(candidateId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: RECRUITMENT_QUERY_KEYS.candidates });
      queryClient.invalidateQueries({ queryKey: RECRUITMENT_QUERY_KEYS.evaluation(variables.candidateId) });
    },
  });

  return {
    createRequisition,
    updateCandidateStage,
    submitEvaluation,
  };
}

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { reviewCycleService } from "../services/reviewCycle.service";
import { useAuthStore } from "../store/authStore";

export const PERFORMANCE_QUERY_KEYS = {
  cycles: ["performance_cycles"] as const,
  reviews: ["performance_reviews"] as const,
  kpis: ["performance_kpis"] as const,
  goals: ["performance_goals"] as const,
  analytics: ["performance_analytics"] as const,
  criteria: ["performance_criteria"] as const,
};

export function usePerformanceCyclesQuery(options?: {
  status?: string;
  page?: number;
  limit?: number;
}) {
  const user = useAuthStore((s) => s.user);
  const companyId = user?.companyId ?? null;
  const isSuperAdmin = user?.role === "SuperAdmin";
  const effectiveTenantKey = companyId || (isSuperAdmin ? "global" : "unauthenticated");

  const query = useQuery({
    queryKey: [...PERFORMANCE_QUERY_KEYS.cycles, effectiveTenantKey, options],
    queryFn: () => reviewCycleService.getCycles(options),
    enabled: Boolean(companyId || isSuperAdmin),
    staleTime: 30_000,
  });
  return {
    cycles: query.data?.data || [],
    total: query.data?.total || 0,
    totalPages: query.data?.totalPages || 0,
    page: query.data?.page || 1,
    limit: query.data?.limit || 50,
    pagination: query.data,
    isLoadingCycles: query.isLoading,
    isRefetchingCycles: query.isFetching,
    ...query,
  };
}

export function usePerformanceReviewsQuery(
  filters: {
    employeeId?: string;
    managerId?: string;
    reviewCycleId?: string;
    status?: string;
    page?: number;
    limit?: number;
  } = {},
  options?: {
    enabled?: boolean;
  },
) {
  const user = useAuthStore((s) => s.user);
  const companyId = user?.companyId ?? null;
  const isSuperAdmin = user?.role === "SuperAdmin";
  const effectiveTenantKey = companyId || (isSuperAdmin ? "global" : "unauthenticated");

  const isEnabled = Boolean(companyId || isSuperAdmin) && (options?.enabled !== false);

  const query = useQuery({
    queryKey: [...PERFORMANCE_QUERY_KEYS.reviews, effectiveTenantKey, filters],
    queryFn: () => reviewCycleService.getReviews(filters),
    enabled: isEnabled,
    staleTime: 30_000,
  });

  const reviews = query.data?.data || (Array.isArray(query.data) ? query.data : []);
  return {
    reviews,
    records: reviews,
    total: query.data?.total ?? reviews.length,
    totalPages: query.data?.totalPages ?? 1,
    page: query.data?.page ?? 1,
    limit: query.data?.limit ?? 50,
    pagination: query.data,
    isLoadingReviews: query.isLoading,
    isRefetchingReviews: query.isFetching,
    ...query,
  };
}

export function usePerformanceKPIsQuery() {
  const user = useAuthStore((s) => s.user);
  const companyId = user?.companyId ?? null;
  const isSuperAdmin = user?.role === "SuperAdmin";
  const effectiveTenantKey = companyId || (isSuperAdmin ? "global" : "unauthenticated");

  const query = useQuery({
    queryKey: [...PERFORMANCE_QUERY_KEYS.kpis, effectiveTenantKey],
    queryFn: () => reviewCycleService.getKPIs(),
    enabled: Boolean(companyId || isSuperAdmin),
    staleTime: 60_000,
  });
  return {
    kpis: query.data || [],
    isLoadingKPIs: query.isLoading,
    ...query,
  };
}

export function usePerformanceGoalsQuery(
  employeeId?: string,
  options?: { page?: number; limit?: number },
) {
  const user = useAuthStore((s) => s.user);
  const companyId = user?.companyId ?? null;
  const isSuperAdmin = user?.role === "SuperAdmin";
  const effectiveTenantKey = companyId || (isSuperAdmin ? "global" : "unauthenticated");

  const query = useQuery({
    queryKey: [...PERFORMANCE_QUERY_KEYS.goals, effectiveTenantKey, employeeId, options],
    queryFn: () => reviewCycleService.getGoals(employeeId, options),
    enabled: Boolean(companyId || isSuperAdmin),
    staleTime: 30_000,
  });

  const goals = query.data?.data || (Array.isArray(query.data) ? query.data : []);
  return {
    goals,
    records: goals,
    total: query.data?.total ?? goals.length,
    totalPages: query.data?.totalPages ?? 1,
    page: query.data?.page ?? 1,
    limit: query.data?.limit ?? 50,
    pagination: query.data,
    isLoadingGoals: query.isLoading,
    ...query,
  };
}

export function usePerformanceAnalyticsQuery() {
  const user = useAuthStore((s) => s.user);
  const companyId = user?.companyId ?? null;
  const isSuperAdmin = user?.role === "SuperAdmin";
  const effectiveTenantKey = companyId || (isSuperAdmin ? "global" : "unauthenticated");

  const query = useQuery({
    queryKey: [...PERFORMANCE_QUERY_KEYS.analytics, effectiveTenantKey],
    queryFn: () => reviewCycleService.getPerformanceAnalytics(),
    enabled: Boolean(companyId || isSuperAdmin),
    staleTime: 30_000,
  });
  return {
    analytics: query.data || null,
    isLoadingAnalytics: query.isLoading,
    ...query,
  };
}

export function usePerformanceCriteriaQuery() {
  const user = useAuthStore((s) => s.user);
  const companyId = user?.companyId ?? null;
  const isSuperAdmin = user?.role === "SuperAdmin";
  const effectiveTenantKey = companyId || (isSuperAdmin ? "global" : "unauthenticated");

  const query = useQuery({
    queryKey: [...PERFORMANCE_QUERY_KEYS.criteria, effectiveTenantKey],
    queryFn: () => reviewCycleService.getCriteria(),
    enabled: Boolean(companyId || isSuperAdmin),
    staleTime: 120_000,
  });
  return {
    criteria: query.data || [],
    isLoadingCriteria: query.isLoading,
    ...query,
  };
}

export function usePerformanceQuery(
  filters: {
    employeeId?: string;
    managerId?: string;
    reviewCycleId?: string;
    status?: string;
  } = {},
) {
  const { cycles, isLoadingCycles } = usePerformanceCyclesQuery();
  const { reviews, isLoadingReviews, isRefetchingReviews } = usePerformanceReviewsQuery(filters);
  const { kpis, isLoadingKPIs } = usePerformanceKPIsQuery();
  const { goals, isLoadingGoals } = usePerformanceGoalsQuery(filters.employeeId);
  const { analytics, isLoadingAnalytics } = usePerformanceAnalyticsQuery();
  const { criteria, isLoadingCriteria } = usePerformanceCriteriaQuery();

  return {
    cycles,
    isLoadingCycles,
    reviews,
    isLoadingReviews,
    isRefetchingReviews,
    kpis,
    isLoadingKPIs,
    goals,
    isLoadingGoals,
    analytics,
    isLoadingAnalytics,
    criteria,
    isLoadingCriteria,
  };
}

export function usePerformanceMutations() {
  const queryClient = useQueryClient();

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: PERFORMANCE_QUERY_KEYS.cycles });
    queryClient.invalidateQueries({ queryKey: PERFORMANCE_QUERY_KEYS.reviews });
    queryClient.invalidateQueries({ queryKey: PERFORMANCE_QUERY_KEYS.kpis });
    queryClient.invalidateQueries({ queryKey: PERFORMANCE_QUERY_KEYS.goals });
    queryClient.invalidateQueries({ queryKey: PERFORMANCE_QUERY_KEYS.analytics });
  };

  const createCycle = useMutation({
    mutationFn: (cycle: any) => reviewCycleService.createCycle(cycle),
    onSuccess: invalidateAll,
  });

  const updateCycle = useMutation({
    mutationFn: ({ id, cycle }: { id: string; cycle: any }) =>
      reviewCycleService.updateCycle(id, cycle),
    onSuccess: invalidateAll,
  });

  const deleteCycle = useMutation({
    mutationFn: (id: string) => reviewCycleService.deleteCycle(id),
    onSuccess: invalidateAll,
  });

  const provisionReviews = useMutation({
    mutationFn: (cycleId: string) => reviewCycleService.provisionReviewsForCycle(cycleId),
    onSuccess: invalidateAll,
  });

  const submitSelfReview = useMutation({
    mutationFn: ({ id, feedback, scores }: { id: string; feedback: string; scores: any[] }) =>
      reviewCycleService.submitSelfReview(id, feedback, scores),
    onSuccess: invalidateAll,
  });

  const submitManagerReview = useMutation({
    mutationFn: ({
      id,
      feedback,
      promotion,
      increment,
      training,
      scores,
    }: {
      id: string;
      feedback: string;
      promotion: boolean;
      increment: boolean;
      training: boolean;
      scores: any[];
    }) =>
      reviewCycleService.submitManagerReview(id, feedback, promotion, increment, training, scores),
    onSuccess: invalidateAll,
  });

  const overrideHrReview = useMutation({
    mutationFn: ({ id, remarks, scores }: { id: string; remarks: string; scores: any[] }) =>
      reviewCycleService.overrideHrReview(id, remarks, scores),
    onSuccess: invalidateAll,
  });

  const approveReview = useMutation({
    mutationFn: (id: string) => reviewCycleService.approveReview(id),
    onSuccess: invalidateAll,
  });

  const completeReview = useMutation({
    mutationFn: (id: string) => reviewCycleService.completeReview(id),
    onSuccess: invalidateAll,
  });

  const createGoal = useMutation({
    mutationFn: (goal: any) => reviewCycleService.createGoal(goal),
    onSuccess: invalidateAll,
  });

  const updateGoal = useMutation({
    mutationFn: ({ id, goal }: { id: string; goal: any }) =>
      reviewCycleService.updateGoal(id, goal),
    onSuccess: invalidateAll,
  });

  const deleteGoal = useMutation({
    mutationFn: (id: string) => reviewCycleService.deleteGoal(id),
    onSuccess: invalidateAll,
  });

  const createKPI = useMutation({
    mutationFn: (kpi: any) => reviewCycleService.createKPI(kpi),
    onSuccess: invalidateAll,
  });

  const updateKPI = useMutation({
    mutationFn: ({ id, kpi }: { id: string; kpi: any }) => reviewCycleService.updateKPI(id, kpi),
    onSuccess: invalidateAll,
  });

  const deleteKPI = useMutation({
    mutationFn: (id: string) => reviewCycleService.deleteKPI(id),
    onSuccess: invalidateAll,
  });

  return {
    createCycle,
    updateCycle,
    deleteCycle,
    provisionReviews,
    submitSelfReview,
    submitManagerReview,
    overrideHrReview,
    approveReview,
    completeReview,
    createGoal,
    updateGoal,
    deleteGoal,
    createKPI,
    updateKPI,
    deleteKPI,
  };
}

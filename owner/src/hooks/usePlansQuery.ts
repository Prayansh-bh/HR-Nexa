import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { plansService, SaaSPlan, PlanDashboardStats, PlanFeature, FeatureItem, AddOn } from "../services/plans.service";
import { realtimeEventsService } from "../services/realtimeEvents.service";

export const PLAN_QUERY_KEYS = {
  all: ["plans"] as const,
  stats: ["planStats"] as const,
  library: ["featureLibrary"] as const,
  addOns: ["addOns"] as const,
  auditLogs: ["planAuditLogs"] as const,
};

export function usePlansQuery() {
  const plansQuery = useQuery<SaaSPlan[]>({
    queryKey: PLAN_QUERY_KEYS.all,
    queryFn: async () => {
      const data = await plansService.getPlans();
      return Array.isArray(data) ? data : [];
    },
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  });

  const statsQuery = useQuery<PlanDashboardStats>({
    queryKey: PLAN_QUERY_KEYS.stats,
    queryFn: () => plansService.getDashboardStats(),
    staleTime: 30_000,
  });

  const libraryQuery = useQuery({
    queryKey: PLAN_QUERY_KEYS.library,
    queryFn: () => plansService.getFeatureLibrary(),
    staleTime: 60_000,
  });

  const addOnsQuery = useQuery({
    queryKey: PLAN_QUERY_KEYS.addOns,
    queryFn: () => plansService.getAddOns(),
    staleTime: 60_000,
  });

  const auditLogsQuery = useQuery({
    queryKey: PLAN_QUERY_KEYS.auditLogs,
    queryFn: () => plansService.getAuditLogs(),
    staleTime: 30_000,
  });

  return {
    plans: plansQuery.data || [],
    isLoadingPlans: plansQuery.isLoading,
    isFetchingPlans: plansQuery.isFetching,
    stats: statsQuery.data,
    isLoadingStats: statsQuery.isLoading,
    library: libraryQuery.data || { categories: [], features: [] },
    addOns: addOnsQuery.data || [],
    auditLogs: auditLogsQuery.data || [],
  };
}

export function usePlanMutations() {
  const queryClient = useQueryClient();

  const createPlan = useMutation({
    mutationFn: (
      payload: Partial<SaaSPlan> & { name: string; features: PlanFeature[]; price?: string },
    ) => plansService.createPlan(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PLAN_QUERY_KEYS.all });
      queryClient.invalidateQueries({ queryKey: PLAN_QUERY_KEYS.stats });
      queryClient.invalidateQueries({ queryKey: PLAN_QUERY_KEYS.auditLogs });
    },
  });

  const updatePlan = useMutation({
    mutationFn: ({
      name,
      payload,
    }: {
      name: string;
      payload: Partial<SaaSPlan> & { features?: PlanFeature[]; price?: string };
    }) => plansService.updatePlan(name, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PLAN_QUERY_KEYS.all });
      queryClient.invalidateQueries({ queryKey: PLAN_QUERY_KEYS.stats });
      queryClient.invalidateQueries({ queryKey: PLAN_QUERY_KEYS.auditLogs });
    },
  });

  const archivePlan = useMutation({
    mutationFn: (nameOrId: string) => plansService.archivePlan(nameOrId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PLAN_QUERY_KEYS.all });
      queryClient.invalidateQueries({ queryKey: PLAN_QUERY_KEYS.stats });
      queryClient.invalidateQueries({ queryKey: PLAN_QUERY_KEYS.auditLogs });
    },
  });

  const restorePlan = useMutation({
    mutationFn: (nameOrId: string) => plansService.restorePlan(nameOrId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PLAN_QUERY_KEYS.all });
      queryClient.invalidateQueries({ queryKey: PLAN_QUERY_KEYS.stats });
      queryClient.invalidateQueries({ queryKey: PLAN_QUERY_KEYS.auditLogs });
    },
  });

  const permanentlyDeletePlan = useMutation({
    mutationFn: (nameOrId: string) => plansService.permanentlyDeletePlan(nameOrId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PLAN_QUERY_KEYS.all });
      queryClient.invalidateQueries({ queryKey: PLAN_QUERY_KEYS.stats });
      queryClient.invalidateQueries({ queryKey: PLAN_QUERY_KEYS.auditLogs });
    },
  });

  const deleteDraftPlan = useMutation({
    mutationFn: (nameOrId: string) => plansService.deleteDraftPlan(nameOrId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PLAN_QUERY_KEYS.all });
      queryClient.invalidateQueries({ queryKey: PLAN_QUERY_KEYS.stats });
      queryClient.invalidateQueries({ queryKey: PLAN_QUERY_KEYS.auditLogs });
    },
  });

  const deletePlan = useMutation({
    mutationFn: (name: string) => plansService.deletePlan(name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PLAN_QUERY_KEYS.all });
      queryClient.invalidateQueries({ queryKey: PLAN_QUERY_KEYS.stats });
      queryClient.invalidateQueries({ queryKey: PLAN_QUERY_KEYS.auditLogs });
    },
  });

  const publishPlan = useMutation({
    mutationFn: ({ id, changelog }: { id: string; changelog?: string }) =>
      plansService.publishPlanVersion(id, changelog),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PLAN_QUERY_KEYS.all });
      queryClient.invalidateQueries({ queryKey: PLAN_QUERY_KEYS.stats });
      queryClient.invalidateQueries({ queryKey: PLAN_QUERY_KEYS.auditLogs });
    },
  });

  const clonePlan = useMutation({
    mutationFn: ({ id, newName }: { id: string; newName: string }) =>
      plansService.clonePlan(id, newName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PLAN_QUERY_KEYS.all });
      queryClient.invalidateQueries({ queryKey: PLAN_QUERY_KEYS.stats });
      queryClient.invalidateQueries({ queryKey: PLAN_QUERY_KEYS.auditLogs });
    },
  });

  const createFeature = useMutation({
    mutationFn: (data: Partial<FeatureItem>) => plansService.createFeature(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PLAN_QUERY_KEYS.library });
      queryClient.invalidateQueries({ queryKey: PLAN_QUERY_KEYS.stats });
      queryClient.invalidateQueries({ queryKey: PLAN_QUERY_KEYS.all });
    },
  });

  const createAddOn = useMutation({
    mutationFn: (data: Partial<AddOn>) => plansService.createAddOn(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PLAN_QUERY_KEYS.addOns });
      queryClient.invalidateQueries({ queryKey: PLAN_QUERY_KEYS.stats });
    },
  });

  return {
    createPlan,
    updatePlan,
    archivePlan,
    restorePlan,
    permanentlyDeletePlan,
    deleteDraftPlan,
    deletePlan,
    publishPlan,
    clonePlan,
    createFeature,
    createAddOn,
  };
}

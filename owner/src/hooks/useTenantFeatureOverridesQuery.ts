import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  featureOverridesService,
  TenantFeatureOverviewItem,
} from "../services/feature-overrides.service";

export const TENANT_FEATURE_OVERRIDES_QUERY_KEYS = {
  all: ["feature-overrides"] as const,
  detail: (companyId: string) => ["feature-overrides", companyId] as const,
};

export function useTenantFeatureOverridesQuery(companyId: string) {
  return useQuery({
    queryKey: TENANT_FEATURE_OVERRIDES_QUERY_KEYS.detail(companyId),
    queryFn: async () => {
      if (!companyId) return { companyId: "", features: [] };
      return featureOverridesService.getCompanyFeatures(companyId);
    },
    enabled: Boolean(companyId),
    staleTime: 60_000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    retry: 2,
  });
}

export function useTenantFeatureOverrideMutations(companyId: string) {
  const queryClient = useQueryClient();

  const setOverrideMutation = useMutation({
    mutationFn: ({
      featureKey,
      data,
    }: {
      featureKey: string;
      data: {
        enabled: boolean;
        reason?: string;
        notes?: string;
        expiresAt?: string | null;
      };
    }) => featureOverridesService.setTenantOverride(companyId, featureKey, data),
    onSuccess: () => {
      // Invalidate ONLY this specific company's query key
      queryClient.invalidateQueries({
        queryKey: TENANT_FEATURE_OVERRIDES_QUERY_KEYS.detail(companyId),
      });
    },
  });

  const removeOverrideMutation = useMutation({
    mutationFn: (featureKey: string) =>
      featureOverridesService.removeTenantOverride(companyId, featureKey),
    onSuccess: () => {
      // Invalidate ONLY this specific company's query key
      queryClient.invalidateQueries({
        queryKey: TENANT_FEATURE_OVERRIDES_QUERY_KEYS.detail(companyId),
      });
    },
  });

  return {
    setOverride: setOverrideMutation,
    removeOverride: removeOverrideMutation,
  };
}

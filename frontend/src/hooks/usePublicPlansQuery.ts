import { useQuery } from "@tanstack/react-query";
import { publicPlansService } from "../services/publicPlans.service";
import { PublicPlansResponse, DEFAULT_PUBLIC_PLANS } from "../components/landing/data/plans";

export const PUBLIC_PLANS_QUERY_KEY = ["public", "plans"] as const;

export function usePublicPlansQuery() {
  return useQuery<PublicPlansResponse>({
    queryKey: PUBLIC_PLANS_QUERY_KEY,
    queryFn: () => publicPlansService.getPublicPlans(),
    placeholderData: { plans: DEFAULT_PUBLIC_PLANS },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    retry: 2,
  });
}

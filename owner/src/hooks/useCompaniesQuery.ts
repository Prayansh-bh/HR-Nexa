import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, useRef } from "react";
import { companyService } from "../services/company.service";
import { realtimeEventsService, ConnectionStatus } from "../services/realtimeEvents.service";
import { SaaSCompany } from "../store/companyStore";

export const COMPANY_QUERY_KEYS = {
  all: ["companies"] as const,
  subscriptions: ["subscriptions"] as const,
  dashboard: ["dashboard"] as const,
  analytics: ["analytics"] as const,
};

export function useCompaniesQuery() {
  const queryClient = useQueryClient();
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>(
    realtimeEventsService.getStatus(),
  );
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const prevStatusRef = useRef<ConnectionStatus | null>(null);

  // Connection status subscription
  useEffect(() => {
    return realtimeEventsService.subscribeStatus((status) => {
      const prev = prevStatusRef.current;
      prevStatusRef.current = status;
      setConnectionStatus(status);

      // Controlled refresh: only trigger refresh if connection was lost and has now recovered
      if (status === "connected" && prev && prev !== "connected") {
        queryClient.invalidateQueries({ queryKey: COMPANY_QUERY_KEYS.all });
      }
    });
  }, [queryClient]);

  const query = useQuery({
    queryKey: COMPANY_QUERY_KEYS.all,
    queryFn: () => companyService.getCompanies(),
    staleTime: 60_000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    retry: 2,
  });

  return {
    ...query,
    companies: query.data || [],
    connectionStatus,
    lastUpdated,
  };
}

export function useCompanyMutations() {
  const queryClient = useQueryClient();

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: COMPANY_QUERY_KEYS.all });
    queryClient.invalidateQueries({ queryKey: COMPANY_QUERY_KEYS.subscriptions });
    queryClient.invalidateQueries({ queryKey: COMPANY_QUERY_KEYS.dashboard });
    queryClient.invalidateQueries({ queryKey: COMPANY_QUERY_KEYS.analytics });
    queryClient.invalidateQueries({ queryKey: ["plans"] });
    queryClient.invalidateQueries({ queryKey: ["planStats"] });
    queryClient.invalidateQueries({ queryKey: ["subscriptionStats"] });
    queryClient.invalidateQueries({ queryKey: ["users"] });
  };

  const createCompany = useMutation({
    mutationFn: (data: Partial<SaaSCompany>) => companyService.createCompany(data),
    onSuccess: () => {
      invalidateAll();
    },
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      companyService.updateCompanyStatus(id, status),
    onSuccess: () => {
      invalidateAll();
    },
  });

  const editProfile = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<SaaSCompany> }) =>
      companyService.editProfile(id, data),
    onSuccess: () => {
      invalidateAll();
    },
  });

  const changePlan = useMutation({
    mutationFn: ({ id, plan }: { id: string; plan: string }) => companyService.changePlan(id, plan),
    onSuccess: () => {
      invalidateAll();
    },
  });

  const addStorage = useMutation({
    mutationFn: ({ id, storageGB }: { id: string; storageGB: number }) =>
      companyService.addStorage(id, storageGB),
    onSuccess: () => {
      invalidateAll();
    },
  });

  const extendTrial = useMutation({
    mutationFn: (id: string) => companyService.extendTrial(id),
    onSuccess: () => {
      invalidateAll();
    },
  });

  const deleteCompany = useMutation({
    mutationFn: (id: string) => companyService.deleteCompany(id),
    onSuccess: () => {
      invalidateAll();
    },
  });

  const purgeCompany = useMutation({
    mutationFn: ({ id, confirmCompanyName }: { id: string; confirmCompanyName: string }) =>
      companyService.purgeCompany(id, confirmCompanyName),
    onSuccess: () => {
      invalidateAll();
    },
  });

  const approveCompany = useMutation({
    mutationFn: (id: string) => companyService.approveCompany(id),
    onSuccess: () => {
      invalidateAll();
    },
  });

  const rejectCompany = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      companyService.rejectCompany(id, reason),
    onSuccess: () => {
      invalidateAll();
    },
  });

  return {
    createCompany,
    updateStatus,
    editProfile,
    changePlan,
    addStorage,
    extendTrial,
    deleteCompany,
    purgeCompany,
    approveCompany,
    rejectCompany,
  };
}

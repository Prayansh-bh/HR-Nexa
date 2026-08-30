import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  platformIntegrationsService,
  CreateIntegrationCredentialPayload,
  UpdateIntegrationCredentialPayload,
} from "../services/integrations.service";

export const PLATFORM_INTEGRATIONS_QUERY_KEYS = {
  all: ["platform-integrations"] as const,
};

export function usePlatformIntegrationsQuery() {
  return useQuery({
    queryKey: PLATFORM_INTEGRATIONS_QUERY_KEYS.all,
    queryFn: () => platformIntegrationsService.listCredentials(),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}

export function usePlatformIntegrationMutations() {
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: (payload: CreateIntegrationCredentialPayload) =>
      platformIntegrationsService.createCredential(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: PLATFORM_INTEGRATIONS_QUERY_KEYS.all,
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: UpdateIntegrationCredentialPayload;
    }) => platformIntegrationsService.updateCredential(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: PLATFORM_INTEGRATIONS_QUERY_KEYS.all,
      });
    },
  });

  const setStatusMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      platformIntegrationsService.setStatus(id, enabled),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: PLATFORM_INTEGRATIONS_QUERY_KEYS.all,
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => platformIntegrationsService.deleteCredential(id),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: PLATFORM_INTEGRATIONS_QUERY_KEYS.all,
      });
    },
  });

  return {
    createMutation,
    updateMutation,
    setStatusMutation,
    deleteMutation,
  };
}

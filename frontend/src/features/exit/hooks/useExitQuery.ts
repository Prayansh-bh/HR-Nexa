import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { exitApi } from "../api/exit.api";
import { useAuthStore } from "../../../store/authStore";

export const useExitQueries = () => {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const companyId = user?.companyId ?? null;

  const useExits = () =>
    useQuery({
      queryKey: ["exits", companyId || "default"],
      queryFn: exitApi.getExits,
      enabled: Boolean(companyId || user?.role === "SuperAdmin"),
    });

  const useExitDetails = (id: string) =>
    useQuery({
      queryKey: ["exit", id],
      queryFn: () => exitApi.getExitDetails(id),
      enabled: Boolean(id && (companyId || user?.role === "SuperAdmin")),
    });

  const useSubmitResignation = () =>
    useMutation({
      mutationFn: exitApi.submitResignation,
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["exits"] });
      },
    });

  const useManagerApprove = () =>
    useMutation({
      mutationFn: ({ id, data }: { id: string; data: any }) => exitApi.managerApprove(id, data),
      onSuccess: (_, variables) => {
        queryClient.invalidateQueries({ queryKey: ["exits"] });
        queryClient.invalidateQueries({ queryKey: ["exit", variables.id] });
      },
    });

  const useHrApprove = () =>
    useMutation({
      mutationFn: ({ id, data }: { id: string; data: any }) => exitApi.hrApprove(id, data),
      onSuccess: (_, variables) => {
        queryClient.invalidateQueries({ queryKey: ["exits"] });
        queryClient.invalidateQueries({ queryKey: ["exit", variables.id] });
      },
    });

  const useAdvanceToChecklist = () =>
    useMutation({
      mutationFn: exitApi.advanceToChecklist,
      onSuccess: (_, id) => {
        queryClient.invalidateQueries({ queryKey: ["exit", id] });
        queryClient.invalidateQueries({ queryKey: ["exits"] });
      },
    });

  const useGenerateSettlement = () =>
    useMutation({
      mutationFn: exitApi.generateSettlement,
      onSuccess: (_, id) => {
        queryClient.invalidateQueries({ queryKey: ["exit", id] });
        queryClient.invalidateQueries({ queryKey: ["exits"] });
      },
    });

  return {
    useExits,
    useExitDetails,
    useSubmitResignation,
    useManagerApprove,
    useHrApprove,
    useAdvanceToChecklist,
    useGenerateSettlement,
  };
};

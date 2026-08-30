import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fiscalYearService, FiscalYearModel } from "../services/fiscalYear.service";
import { useAuthStore } from "../store/authStore";
import { useHasPermission } from "../auth/useHasPermission";
import { PERMISSIONS } from "../auth/permissions";

export const FISCAL_YEAR_QUERY_KEYS = {
  all: ["fiscalYears"] as const,
  detail: ["fiscalYears", "detail"] as const,
};

export function useFiscalYearsQuery() {
  const user = useAuthStore((s) => s.user);
  const companyId = user?.companyId ?? null;
  const isSuperAdmin = user?.role === "SuperAdmin";
  const hasSettingsView = useHasPermission([
    PERMISSIONS.SETTINGS_COMPANY_VIEW,
    PERMISSIONS.FISCAL_YEAR_VIEW,
  ], "any");

  return useQuery({
    queryKey: [...FISCAL_YEAR_QUERY_KEYS.all, companyId || "default"],
    queryFn: () => fiscalYearService.getFiscalYears(),
    enabled: Boolean((companyId || isSuperAdmin) && (hasSettingsView || isSuperAdmin)),
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
}

export function useFiscalYearMutations() {
  const queryClient = useQueryClient();

  const createFiscalYear = useMutation({
    mutationFn: (data: { name: string; startDate: string; endDate: string }) =>
      fiscalYearService.createFiscalYear(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: FISCAL_YEAR_QUERY_KEYS.all });
    },
  });

  const updateFiscalYear = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { name?: string; startDate?: string; endDate?: string } }) =>
      fiscalYearService.updateFiscalYear(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: FISCAL_YEAR_QUERY_KEYS.all });
    },
  });

  const activateFiscalYear = useMutation({
    mutationFn: (id: string) => fiscalYearService.activateFiscalYear(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: FISCAL_YEAR_QUERY_KEYS.all });
    },
  });

  const closeFiscalYear = useMutation({
    mutationFn: (id: string) => fiscalYearService.closeFiscalYear(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: FISCAL_YEAR_QUERY_KEYS.all });
    },
  });

  const lockFiscalYear = useMutation({
    mutationFn: (id: string) => fiscalYearService.lockFiscalYear(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: FISCAL_YEAR_QUERY_KEYS.all });
    },
  });

  const deleteFiscalYear = useMutation({
    mutationFn: (id: string) => fiscalYearService.deleteFiscalYear(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: FISCAL_YEAR_QUERY_KEYS.all });
    },
  });

  return {
    createFiscalYear,
    updateFiscalYear,
    activateFiscalYear,
    closeFiscalYear,
    lockFiscalYear,
    deleteFiscalYear,
  };
}

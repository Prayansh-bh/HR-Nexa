import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { taxDeclarationService, TaxDeclarationItemModel } from "../services/taxDeclaration.service";
import { useAuthStore } from "../store/authStore";
import { useHasPermission } from "../auth/useHasPermission";
import { PERMISSIONS } from "../auth/permissions";

export const TAX_DECLARATION_QUERY_KEYS = {
  all: ["taxDeclarations"] as const,
  my: ["taxDeclarations", "my"] as const,
  tenant: ["taxDeclarations", "tenant"] as const,
  detail: ["taxDeclarations", "detail"] as const,
};

export function useMyTaxDeclarationQuery(fiscalYearId?: string) {
  const user = useAuthStore((s) => s.user);
  const companyId = user?.companyId ?? null;

  return useQuery({
    queryKey: [...TAX_DECLARATION_QUERY_KEYS.my, companyId || "default", fiscalYearId],
    queryFn: () => taxDeclarationService.getMyDeclaration(fiscalYearId),
    enabled: Boolean(companyId || user?.role === "SuperAdmin"),
    staleTime: 60_000,
  });
}

export function useTenantTaxDeclarationsQuery(params?: {
  fiscalYearId?: string;
  status?: string;
  page?: number;
  limit?: number;
}) {
  const user = useAuthStore((s) => s.user);
  const companyId = user?.companyId ?? null;
  const isSuperAdmin = user?.role === "SuperAdmin";
  const hasManagePermission = useHasPermission(PERMISSIONS.TAX_DECLARATIONS_MANAGE);

  const query = useQuery({
    queryKey: [...TAX_DECLARATION_QUERY_KEYS.tenant, companyId || "default", params],
    queryFn: () => taxDeclarationService.getTenantDeclarations(params),
    enabled: Boolean((companyId || isSuperAdmin) && (hasManagePermission || isSuperAdmin)),
    staleTime: 30_000,
  });

  const declarations = Array.isArray(query.data)
    ? query.data
    : Array.isArray(query.data?.data)
    ? query.data.data
    : [];

  return {
    ...query,
    declarations,
    records: declarations,
    total: query.data?.total ?? declarations.length,
    page: query.data?.page ?? params?.page ?? 1,
    limit: query.data?.limit ?? params?.limit ?? 50,
    totalPages: query.data?.totalPages ?? (declarations.length > 0 ? 1 : 0),
  };
}

export function useTaxDeclarationMutations() {
  const queryClient = useQueryClient();

  const createMyDeclaration = useMutation({
    mutationFn: (data: { fiscalYearId: string; regime: "OLD" | "NEW"; items: TaxDeclarationItemModel[] }) =>
      taxDeclarationService.createMyDeclaration(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TAX_DECLARATION_QUERY_KEYS.all });
    },
  });

  const updateMyDeclaration = useMutation({
    mutationFn: (data: { fiscalYearId: string; regime: "OLD" | "NEW"; items: TaxDeclarationItemModel[] }) =>
      taxDeclarationService.updateMyDeclaration(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TAX_DECLARATION_QUERY_KEYS.all });
    },
  });

  const submitMyDeclaration = useMutation({
    mutationFn: (fiscalYearId: string) => taxDeclarationService.submitMyDeclaration(fiscalYearId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TAX_DECLARATION_QUERY_KEYS.all });
    },
  });

  const auditDeclaration = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: {
        decision: "APPROVED" | "REJECTED" | "CORRECTION_REQUIRED";
        remarks?: string;
        itemApprovals?: Array<{ itemId: string; approvedAmount: number; remarks?: string }>;
      };
    }) => taxDeclarationService.auditDeclaration(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TAX_DECLARATION_QUERY_KEYS.all });
    },
  });

  return {
    createMyDeclaration,
    updateMyDeclaration,
    submitMyDeclaration,
    auditDeclaration,
  };
}

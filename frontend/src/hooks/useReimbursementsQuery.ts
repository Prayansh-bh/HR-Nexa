import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  reimbursementService,
  ExpenseClaimItemModel,
  ExpenseCategoryModel,
} from "../services/reimbursement.service";
import { useAuthStore } from "../store/authStore";
import { useHasPermission } from "../auth/useHasPermission";
import { PERMISSIONS } from "../auth/permissions";

export const REIMBURSEMENT_QUERY_KEYS = {
  all: ["reimbursements"] as const,
  categories: ["reimbursements", "categories"] as const,
  my: ["reimbursements", "my"] as const,
  tenant: ["reimbursements", "tenant"] as const,
  detail: ["reimbursements", "detail"] as const,
};

export function useExpenseCategoriesQuery() {
  const user = useAuthStore((s) => s.user);
  const companyId = user?.companyId ?? null;

  return useQuery({
    queryKey: [...REIMBURSEMENT_QUERY_KEYS.categories, companyId || "default", "active"],
    queryFn: () => reimbursementService.getCategories(true),
    enabled: Boolean(companyId || user?.role === "SuperAdmin"),
    staleTime: 5 * 60_000,
  });
}

export function useAdminExpenseCategoriesQuery(activeOnly = false) {
  const user = useAuthStore((s) => s.user);
  const companyId = user?.companyId ?? null;
  const isSuperAdmin = user?.role === "SuperAdmin";
  const hasManagePermission = useHasPermission([PERMISSIONS.EXPENSES_MANAGE], "any");

  return useQuery({
    queryKey: [...REIMBURSEMENT_QUERY_KEYS.categories, companyId || "default", activeOnly ? "active" : "all"],
    queryFn: () => reimbursementService.getCategories(activeOnly),
    enabled: Boolean((companyId || isSuperAdmin) && (hasManagePermission || isSuperAdmin)),
    staleTime: 60_000,
  });
}

export function useMyExpenseClaimsQuery(fiscalYearId?: string) {
  const user = useAuthStore((s) => s.user);
  const companyId = user?.companyId ?? null;

  const query = useQuery({
    queryKey: [...REIMBURSEMENT_QUERY_KEYS.my, companyId || "default", fiscalYearId],
    queryFn: () => reimbursementService.getMyClaims(fiscalYearId),
    enabled: Boolean(companyId || user?.role === "SuperAdmin"),
    staleTime: 30_000,
  });

  const claims = Array.isArray(query.data)
    ? query.data
    : Array.isArray(query.data?.data)
    ? query.data.data
    : [];

  return {
    ...query,
    claims,
    records: claims,
    total: query.data?.total ?? claims.length,
    page: query.data?.page ?? 1,
    limit: query.data?.limit ?? 50,
    totalPages: query.data?.totalPages ?? (claims.length > 0 ? 1 : 0),
  };
}

export function useTenantExpenseClaimsQuery(params?: {
  fiscalYearId?: string;
  employeeId?: string;
  status?: string;
  paymentStatus?: string;
  page?: number;
  limit?: number;
}) {
  const user = useAuthStore((s) => s.user);
  const companyId = user?.companyId ?? null;
  const isSuperAdmin = user?.role === "SuperAdmin";
  const hasManagePermission = useHasPermission([
    PERMISSIONS.EXPENSES_MANAGE,
    PERMISSIONS.EXPENSES_APPROVE,
  ], "any");

  const query = useQuery({
    queryKey: [...REIMBURSEMENT_QUERY_KEYS.tenant, companyId || "default", params],
    queryFn: () => reimbursementService.getTenantClaims(params),
    enabled: Boolean((companyId || isSuperAdmin) && (hasManagePermission || isSuperAdmin)),
    staleTime: 30_000,
  });

  const claims = Array.isArray(query.data)
    ? query.data
    : Array.isArray(query.data?.data)
    ? query.data.data
    : [];

  return {
    ...query,
    claims,
    records: claims,
    total: query.data?.total ?? claims.length,
    page: query.data?.page ?? params?.page ?? 1,
    limit: query.data?.limit ?? params?.limit ?? 50,
    totalPages: query.data?.totalPages ?? (claims.length > 0 ? 1 : 0),
  };
}

export function useExpenseClaimMutations() {
  const queryClient = useQueryClient();

  const createCategory = useMutation({
    mutationFn: (data: Partial<ExpenseCategoryModel>) => reimbursementService.createCategory(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: REIMBURSEMENT_QUERY_KEYS.categories });
    },
  });

  const updateCategory = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ExpenseCategoryModel> }) =>
      reimbursementService.updateCategory(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: REIMBURSEMENT_QUERY_KEYS.categories });
    },
  });

  const createMyClaim = useMutation({
    mutationFn: (data: { fiscalYearId: string; title: string; description?: string; items: ExpenseClaimItemModel[] }) =>
      reimbursementService.createMyClaim(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: REIMBURSEMENT_QUERY_KEYS.all });
    },
  });

  const updateMyClaimDraft = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { title?: string; description?: string; items?: ExpenseClaimItemModel[] } }) =>
      reimbursementService.updateMyClaimDraft(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: REIMBURSEMENT_QUERY_KEYS.all });
    },
  });

  const submitMyClaim = useMutation({
    mutationFn: (id: string) => reimbursementService.submitMyClaim(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: REIMBURSEMENT_QUERY_KEYS.all });
    },
  });

  const reviewClaim = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: {
        decision: "APPROVED" | "REJECTED" | "CORRECTION_REQUIRED";
        remarks?: string;
        itemApprovals?: Array<{ itemId: string; approvedAmount: number; taxTreatment?: "TAXABLE" | "NON_TAXABLE"; remarks?: string }>;
      };
    }) => reimbursementService.reviewClaim(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: REIMBURSEMENT_QUERY_KEYS.all });
    },
  });

  const payClaim = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: {
        paymentMethod: "PAYROLL" | "BANK_TRANSFER" | "OFF_CYCLE";
        paymentReference?: string;
        remarks?: string;
      };
    }) => reimbursementService.payClaim(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: REIMBURSEMENT_QUERY_KEYS.all });
    },
  });

  return {
    createCategory,
    updateCategory,
    createMyClaim,
    updateMyClaimDraft,
    submitMyClaim,
    reviewClaim,
    payClaim,
  };
}

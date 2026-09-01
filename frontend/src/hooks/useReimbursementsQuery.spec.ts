import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  useExpenseCategoriesQuery,
  useAdminExpenseCategoriesQuery,
  useExpenseClaimMutations,
  REIMBURSEMENT_QUERY_KEYS,
} from "./useReimbursementsQuery";
import { reimbursementService } from "../services/reimbursement.service";
import * as authStoreModule from "../store/authStore";
import * as useHasPermissionModule from "../auth/useHasPermission";

vi.mock("../services/reimbursement.service", () => ({
  reimbursementService: {
    getCategories: vi.fn(),
    createCategory: vi.fn(),
    updateCategory: vi.fn(),
    getMyClaims: vi.fn(),
    getTenantClaims: vi.fn(),
    createMyClaim: vi.fn(),
    updateMyClaimDraft: vi.fn(),
    submitMyClaim: vi.fn(),
    reviewClaim: vi.fn(),
    payClaim: vi.fn(),
  },
}));

describe("useReimbursementsQuery — Expense Category Data Layer Specs (P1-1B)", () => {
  let queryClient: QueryClient;

  const mockCategories = [
    {
      id: "cat-travel-1",
      companyId: "COMP-1",
      name: "Travel & Conveyance",
      code: "TRAVEL",
      maxLimit: 10000,
      requireReceipt: true,
      isTaxable: false,
      isActive: true,
    },
    {
      id: "cat-old-2",
      companyId: "COMP-1",
      name: "Deprecated Allowance",
      code: "OLD_HEAD",
      maxLimit: 1000,
      requireReceipt: false,
      isTaxable: false,
      isActive: false,
    },
  ];

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
    vi.clearAllMocks();

    vi.spyOn(authStoreModule, "useAuthStore").mockImplementation((selector: any) =>
      selector({
        user: {
          id: "usr-admin",
          role: "HRAdmin",
          companyId: "COMP-1",
        },
      }),
    );

    vi.spyOn(useHasPermissionModule, "useHasPermission").mockReturnValue(true);
  });

  const createWrapper = () => {
    return ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children);
  };

  it("1. should fetch active categories for employee via useExpenseCategoriesQuery()", async () => {
    vi.mocked(reimbursementService.getCategories).mockResolvedValue([mockCategories[0]]);

    const { result } = renderHook(() => useExpenseCategoriesQuery(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(reimbursementService.getCategories).toHaveBeenCalledWith(true);
    expect(result.current.data).toHaveLength(1);
    expect(result.current.data?.[0].code).toBe("TRAVEL");
  });

  it("2. should fetch all categories (including inactive) for admin via useAdminExpenseCategoriesQuery(false)", async () => {
    vi.mocked(reimbursementService.getCategories).mockResolvedValue(mockCategories);

    const { result } = renderHook(() => useAdminExpenseCategoriesQuery(false), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(reimbursementService.getCategories).toHaveBeenCalledWith(false);
    expect(result.current.data).toHaveLength(2);
    expect(result.current.data?.some((c) => !c.isActive)).toBe(true);
  });

  it("3. should call reimbursementService.createCategory and invalidate category cache on createCategory mutation", async () => {
    const newCategory = {
      name: "Client Meals",
      code: "MEALS",
      maxLimit: 3000,
      requireReceipt: true,
      isTaxable: true,
    };
    const createdCategory = { id: "cat-meals-new", ...newCategory, companyId: "COMP-1", isActive: true };

    vi.mocked(reimbursementService.createCategory).mockResolvedValue(createdCategory as any);
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useExpenseClaimMutations(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.createCategory.mutateAsync(newCategory);
    });

    expect(reimbursementService.createCategory).toHaveBeenCalledWith(newCategory);
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: REIMBURSEMENT_QUERY_KEYS.categories,
    });
  });

  it("4. should call reimbursementService.updateCategory and invalidate category cache on updateCategory mutation", async () => {
    const updatePayload = {
      maxLimit: 15000,
      isActive: false,
    };
    const updatedCategory = { ...mockCategories[0], ...updatePayload };

    vi.mocked(reimbursementService.updateCategory).mockResolvedValue(updatedCategory as any);
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useExpenseClaimMutations(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.updateCategory.mutateAsync({
        id: "cat-travel-1",
        data: updatePayload,
      });
    });

    expect(reimbursementService.updateCategory).toHaveBeenCalledWith("cat-travel-1", updatePayload);
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: REIMBURSEMENT_QUERY_KEYS.categories,
    });
  });

  it("5. should preserve employee category isolation and enabled state", async () => {
    // When user has no companyId and is not SuperAdmin, query should not fire
    vi.spyOn(authStoreModule, "useAuthStore").mockImplementation((selector: any) =>
      selector({
        user: null,
      }),
    );

    const { result } = renderHook(() => useExpenseCategoriesQuery(), {
      wrapper: createWrapper(),
    });

    expect(result.current.fetchStatus).toBe("idle");
    expect(reimbursementService.getCategories).not.toHaveBeenCalled();
  });
});

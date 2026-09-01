import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { ExpenseCategoriesAdminPage } from "./ExpenseCategoriesAdminPage";
import * as reimbursementsQueryModule from "../../../hooks/useReimbursementsQuery";
import * as useHasPermissionModule from "../../../auth/useHasPermission";

vi.mock("../../../hooks/useReimbursementsQuery", () => ({
  useAdminExpenseCategoriesQuery: vi.fn(),
  useExpenseClaimMutations: vi.fn(),
}));

vi.mock("../../../auth/useHasPermission", () => ({
  useHasPermission: vi.fn(),
}));

describe("ExpenseCategoriesAdminPage (P1-1C Component Specs)", () => {
  const mockToast = vi.fn();

  const mockCategories = [
    {
      id: "cat-1",
      companyId: "COMP-1",
      name: "Travel & Conveyance",
      code: "TRAVEL",
      description: "Local taxi and outstation flights",
      maxLimit: 10000,
      requireReceipt: true,
      isTaxable: false,
      isActive: true,
    },
    {
      id: "cat-2",
      companyId: "COMP-1",
      name: "Legacy Meals Head",
      code: "MEALS_OLD",
      description: "Deprecated meal allowance",
      maxLimit: 1500,
      requireReceipt: false,
      isTaxable: true,
      isActive: false,
    },
  ];

  const mockMutations = {
    createCategory: { mutateAsync: vi.fn() },
    updateCategory: { mutateAsync: vi.fn() },
  };

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(useHasPermissionModule.useHasPermission).mockReturnValue(true);

    vi.mocked(reimbursementsQueryModule.useAdminExpenseCategoriesQuery).mockReturnValue({
      data: mockCategories,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as any);

    vi.mocked(reimbursementsQueryModule.useExpenseClaimMutations).mockReturnValue(
      mockMutations as any,
    );
  });

  it("1. should restrict view and show Access Restricted banner when user lacks EXPENSES_MANAGE permission", () => {
    vi.mocked(useHasPermissionModule.useHasPermission).mockReturnValue(false);

    render(<ExpenseCategoriesAdminPage toast={mockToast} />);

    expect(screen.getByText("Access Restricted")).toBeInTheDocument();
    expect(screen.queryByText("New Category")).not.toBeInTheDocument();
    expect(screen.queryByText("Travel & Conveyance")).not.toBeInTheDocument();
  });

  it("2. should render category table including codes, limits, receipt badges, and inactive items", () => {
    render(<ExpenseCategoriesAdminPage toast={mockToast} />);

    expect(screen.getByText("Expense Categories & Policies")).toBeInTheDocument();
    expect(screen.getByText("Travel & Conveyance")).toBeInTheDocument();
    expect(screen.getByText("TRAVEL")).toBeInTheDocument();
    expect(screen.getByText("₹10,000")).toBeInTheDocument();
    expect(screen.getByText("Legacy Meals Head")).toBeInTheDocument();
    expect(screen.getByText("MEALS_OLD")).toBeInTheDocument();

    // Verify both Active and Inactive badges are rendered
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByText("Inactive")).toBeInTheDocument();
  });

  it("3. should open create modal, validate inputs, and submit new category", async () => {
    mockMutations.createCategory.mutateAsync.mockResolvedValue({ id: "cat-3" });

    render(<ExpenseCategoriesAdminPage toast={mockToast} />);

    fireEvent.click(screen.getByText("New Category"));

    expect(screen.getByText("Create Expense Category")).toBeInTheDocument();

    // Fill form
    fireEvent.change(screen.getByPlaceholderText(/Client Entertainment/i), {
      target: { value: "Office Supplies" },
    });
    fireEvent.change(screen.getByPlaceholderText(/MEALS_CLIENT/i), {
      target: { value: "OFFICE" },
    });
    fireEvent.change(screen.getByPlaceholderText(/Leave blank for no upper cap/i), {
      target: { value: "5000" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Create Category" }));

    await waitFor(() => {
      expect(mockMutations.createCategory.mutateAsync).toHaveBeenCalledWith({
        name: "Office Supplies",
        code: "OFFICE",
        description: undefined,
        maxLimit: 5000,
        requireReceipt: true,
        isTaxable: false,
      });
      expect(mockToast).toHaveBeenCalledWith('Expense category "Office Supplies" created successfully!');
    });
  });

  it("4. should show validation error if negative limit or empty name is entered", async () => {
    render(<ExpenseCategoriesAdminPage toast={mockToast} />);

    fireEvent.click(screen.getByText("New Category"));

    // Enter negative limit
    fireEvent.change(screen.getByPlaceholderText(/Client Entertainment/i), {
      target: { value: "Internet" },
    });
    fireEvent.change(screen.getByPlaceholderText(/MEALS_CLIENT/i), {
      target: { value: "WIFI" },
    });
    fireEvent.change(screen.getByPlaceholderText(/Leave blank for no upper cap/i), {
      target: { value: "-500" },
    });

    const createBtn = screen.getByRole("button", { name: "Create Category" });
    fireEvent.submit(createBtn.closest("form")!);

    expect(screen.getByText("Maximum limit must be a positive number.")).toBeInTheDocument();
    expect(mockMutations.createCategory.mutateAsync).not.toHaveBeenCalled();
  });

  it("5. should open edit modal pre-filled and save updated policy", async () => {
    mockMutations.updateCategory.mutateAsync.mockResolvedValue({ id: "cat-1" });

    render(<ExpenseCategoriesAdminPage toast={mockToast} />);

    const editButtons = screen.getAllByRole("button", { name: /Edit/i });
    fireEvent.click(editButtons[0]);

    expect(screen.getByText("Edit Category: Travel & Conveyance")).toBeInTheDocument();

    // Change limit
    const limitInput = screen.getByDisplayValue("10000");
    fireEvent.change(limitInput, { target: { value: "15000" } });

    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() => {
      expect(mockMutations.updateCategory.mutateAsync).toHaveBeenCalledWith({
        id: "cat-1",
        data: expect.objectContaining({
          name: "Travel & Conveyance",
          maxLimit: 15000,
        }),
      });
      expect(mockToast).toHaveBeenCalledWith('Expense category "Travel & Conveyance" updated successfully!');
    });
  });

  it("6. should toggle active status when Activate / Deactivate button is clicked", async () => {
    mockMutations.updateCategory.mutateAsync.mockResolvedValue({ id: "cat-1" });

    render(<ExpenseCategoriesAdminPage toast={mockToast} />);

    // Click Deactivate on active category
    const deactivateBtn = screen.getByRole("button", { name: /Deactivate/i });
    fireEvent.click(deactivateBtn);

    await waitFor(() => {
      expect(mockMutations.updateCategory.mutateAsync).toHaveBeenCalledWith({
        id: "cat-1",
        data: { isActive: false },
      });
      expect(mockToast).toHaveBeenCalledWith('Category "Travel & Conveyance" deactivated successfully');
    });
  });

  it("7. should handle mutation error gracefully with toast alert", async () => {
    mockMutations.createCategory.mutateAsync.mockRejectedValue(
      new Error("Category code 'TRAVEL' already exists"),
    );

    render(<ExpenseCategoriesAdminPage toast={mockToast} />);

    fireEvent.click(screen.getByText("New Category"));

    fireEvent.change(screen.getByPlaceholderText(/Client Entertainment/i), {
      target: { value: "Travel Duplicate" },
    });
    fireEvent.change(screen.getByPlaceholderText(/MEALS_CLIENT/i), {
      target: { value: "TRAVEL" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Create Category" }));

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith("Category code 'TRAVEL' already exists");
      // Modal should stay open
      expect(screen.getByText("Create Expense Category")).toBeInTheDocument();
    });
  });

  it("8. should display empty state when 0 categories exist and allow creating first category", () => {
    vi.mocked(reimbursementsQueryModule.useAdminExpenseCategoriesQuery).mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as any);

    render(<ExpenseCategoriesAdminPage toast={mockToast} />);

    expect(screen.getByText("No Expense Categories Configured")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create First Category" })).toBeInTheDocument();
  });

  it("9. should display error state with retry button when query fails", () => {
    const refetchMock = vi.fn();
    vi.mocked(reimbursementsQueryModule.useAdminExpenseCategoriesQuery).mockReturnValue({
      data: [],
      isLoading: false,
      isError: true,
      refetch: refetchMock,
    } as any);

    render(<ExpenseCategoriesAdminPage toast={mockToast} />);

    expect(screen.getByText(/Failed to load expense categories/i)).toBeInTheDocument();
    const retryBtn = screen.getByRole("button", { name: "Retry" });
    fireEvent.click(retryBtn);
    expect(refetchMock).toHaveBeenCalled();
  });
});


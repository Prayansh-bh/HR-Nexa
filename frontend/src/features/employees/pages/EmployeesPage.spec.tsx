import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { EmployeesPage } from "./EmployeesPage";
import * as employeesQueryModule from "../../../hooks/useEmployeesQuery";
import * as orgQueryModule from "../../../hooks/useOrgQuery";
import { useAuthStore } from "../../../store/authStore";

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual: any = await importOriginal();
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    Link: ({ children, to, ...props }: any) => <a href={to} {...props}>{children}</a>,
  };
});

vi.mock("../../../hooks/useEmployeesQuery", () => ({
  useEmployeesQuery: vi.fn(),
  useOrgChartQuery: vi.fn(() => ({ data: [] })),
  useEmployeeMutations: vi.fn(() => ({
    createEmployee: { mutateAsync: vi.fn() },
    updateEmployee: { mutateAsync: vi.fn() },
    deleteEmployee: { mutateAsync: vi.fn() },
  })),
}));

vi.mock("../../../hooks/useOrgQuery", () => ({
  useDepartmentsQuery: vi.fn(() => ({ data: [{ id: "d1", name: "Engineering" }, { id: "d2", name: "Sales" }] })),
  useDesignationsQuery: vi.fn(() => ({ data: [{ id: "des1", name: "Software Engineer", band: "L1" }] })),
  useOrgMutations: vi.fn(() => ({
    createDepartment: { mutateAsync: vi.fn() },
    deleteDepartment: { mutateAsync: vi.fn() },
    createDesignation: { mutateAsync: vi.fn() },
    deleteDesignation: { mutateAsync: vi.fn() },
  })),
}));

describe("EmployeesPage Pagination & Server Filtering Suite", () => {
  const mockEmployees = [
    {
      id: "EMP-001",
      name: "Alice Johnson",
      email: "alice@acmecorp.com",
      department: "Engineering",
      designation: "Software Engineer",
      salary: 90000,
      status: "Active",
      joined: "2024-01-15",
    },
    {
      id: "EMP-002",
      name: "Bob Smith",
      email: "bob@acmecorp.com",
      department: "Sales",
      designation: "Account Executive",
      salary: 75000,
      status: "Active",
      joined: "2024-02-01",
    },
  ];

  const mockUser = {
    id: "user-admin-1",
    name: "Admin User",
    email: "admin@acmecorp.com",
    role: "SuperAdmin",
    companyId: "comp-1",
    permissions: ["employees:list:view", "employees:list:edit", "employees:salary:view"],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({
      user: mockUser as any,
    });

    vi.mocked(employeesQueryModule.useEmployeesQuery).mockReturnValue({
      employees: mockEmployees,
      total: 50,
      totalPages: 2,
      page: 1,
      limit: 25,
      pagination: {
        data: mockEmployees,
        total: 50,
        totalPages: 2,
        page: 1,
        limit: 25,
      },
      isLoading: false,
      isFetching: false,
    } as any);
  });

  it("1. Initial render calls useEmployeesQuery with page=1 and limit=25", () => {
    render(
      <EmployeesPage
        sub="employees.list"
        setActive={vi.fn()}
        user={mockUser as any}
        toast={vi.fn()}
        triggerConfirm={vi.fn()}
        onAddEmployee={vi.fn()}
        onEditEmployee={vi.fn()}
        onMessageEmployee={vi.fn()}
        onView={vi.fn()}
      />,
    );

    expect(employeesQueryModule.useEmployeesQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        page: 1,
        limit: 25,
      }),
    );
    expect(screen.getByText("Alice Johnson")).toBeInTheDocument();
    expect(screen.getByText("Bob Smith")).toBeInTheDocument();
    expect(screen.getByTestId("pagination-summary")).toHaveTextContent("Showing 1 to 25 of 50 records");
  });

  it("2. Clicking Next page button passes page=2 to query", async () => {
    render(
      <EmployeesPage
        sub="employees.list"
        setActive={vi.fn()}
        user={mockUser as any}
        toast={vi.fn()}
        triggerConfirm={vi.fn()}
        onAddEmployee={vi.fn()}
        onEditEmployee={vi.fn()}
        onMessageEmployee={vi.fn()}
        onView={vi.fn()}
      />,
    );

    const nextBtn = screen.getByTestId("pagination-next");
    expect(nextBtn).not.toBeDisabled();
    fireEvent.click(nextBtn);

    await waitFor(() => {
      expect(employeesQueryModule.useEmployeesQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          page: 2,
          limit: 25,
        }),
      );
    });
  });

  it("3. Changing rows per page dropdown resets page to 1 with new limit", async () => {
    render(
      <EmployeesPage
        sub="employees.list"
        setActive={vi.fn()}
        user={mockUser as any}
        toast={vi.fn()}
        triggerConfirm={vi.fn()}
        onAddEmployee={vi.fn()}
        onEditEmployee={vi.fn()}
        onMessageEmployee={vi.fn()}
        onView={vi.fn()}
      />,
    );

    const pageSizeSelect = screen.getByLabelText("Rows per page");
    fireEvent.change(pageSizeSelect, { target: { value: "50" } });

    await waitFor(() => {
      expect(employeesQueryModule.useEmployeesQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          page: 1,
          limit: 50,
        }),
      );
    });
  });

  it("4. Typing search input debounces and passes search text to useEmployeesQuery", async () => {
    render(
      <EmployeesPage
        sub="employees.list"
        setActive={vi.fn()}
        user={mockUser as any}
        toast={vi.fn()}
        triggerConfirm={vi.fn()}
        onAddEmployee={vi.fn()}
        onEditEmployee={vi.fn()}
        onMessageEmployee={vi.fn()}
        onView={vi.fn()}
      />,
    );

    const searchInput = screen.getByPlaceholderText("Search by name or email…");
    fireEvent.change(searchInput, { target: { value: "Alice" } });

    await waitFor(
      () => {
        expect(employeesQueryModule.useEmployeesQuery).toHaveBeenCalledWith(
          expect.objectContaining({
            page: 1,
            search: "Alice",
          }),
        );
      },
      { timeout: 1000 },
    );
  });

  it("5. Filter dropdown changes reset page to 1 with selected filter", async () => {
    render(
      <EmployeesPage
        sub="employees.list"
        setActive={vi.fn()}
        user={mockUser as any}
        toast={vi.fn()}
        triggerConfirm={vi.fn()}
        onAddEmployee={vi.fn()}
        onEditEmployee={vi.fn()}
        onMessageEmployee={vi.fn()}
        onView={vi.fn()}
      />,
    );

    // Open filter popover
    const filterBtn = screen.getByRole("button", { name: /filter/i });
    fireEvent.click(filterBtn);

    const deptSelect = screen.getByLabelText("Department Filter");
    fireEvent.change(deptSelect, { target: { value: "Engineering" } });

    await waitFor(() => {
      expect(employeesQueryModule.useEmployeesQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          page: 1,
          department: "Engineering",
        }),
      );
    });
  });

  it("6. Displays empty state message when total records is 0", () => {
    vi.mocked(employeesQueryModule.useEmployeesQuery).mockReturnValue({
      employees: [],
      total: 0,
      totalPages: 0,
      page: 1,
      limit: 25,
      pagination: {
        data: [],
        total: 0,
        totalPages: 0,
        page: 1,
        limit: 25,
      },
      isLoading: false,
      isFetching: false,
    } as any);

    render(
      <EmployeesPage
        sub="employees.list"
        setActive={vi.fn()}
        user={mockUser as any}
        toast={vi.fn()}
        triggerConfirm={vi.fn()}
        onAddEmployee={vi.fn()}
        onEditEmployee={vi.fn()}
        onMessageEmployee={vi.fn()}
        onView={vi.fn()}
      />,
    );

    expect(screen.getByText("No employees found.")).toBeInTheDocument();
    expect(screen.getByTestId("pagination-summary")).toHaveTextContent("No records to display");
  });
});

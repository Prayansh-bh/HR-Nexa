import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { SearchablePaginatedSelect } from "./SearchablePaginatedSelect";

describe("SearchablePaginatedSelect Component", () => {
  const mockQueryFn = vi.fn().mockResolvedValue({
    data: [
      { value: "emp-1", label: "Alice Johnson", sublabel: "Engineering" },
      { value: "emp-2", label: "Bob Smith", sublabel: "Design" },
    ],
    total: 2,
    page: 1,
    limit: 10,
    totalPages: 1,
  });

  it("renders trigger with placeholder initially", () => {
    render(
      <SearchablePaginatedSelect
        placeholder="Select employee..."
        onChange={vi.fn()}
        queryFn={mockQueryFn}
      />,
    );

    expect(screen.getByRole("combobox")).toHaveTextContent("Select employee...");
  });

  it("opens popover, triggers server query, and displays options", async () => {
    render(
      <SearchablePaginatedSelect
        placeholder="Select employee..."
        onChange={vi.fn()}
        queryFn={mockQueryFn}
      />,
    );

    fireEvent.click(screen.getByRole("combobox"));

    await waitFor(() => {
      expect(mockQueryFn).toHaveBeenCalled();
      expect(screen.getByText("Alice Johnson")).toBeInTheDocument();
      expect(screen.getByText("Bob Smith")).toBeInTheDocument();
    });
  });

  it("invokes onChange callback and updates trigger label when item is selected", async () => {
    const onChange = vi.fn();
    render(
      <SearchablePaginatedSelect
        placeholder="Select employee..."
        onChange={onChange}
        queryFn={mockQueryFn}
      />,
    );

    fireEvent.click(screen.getByRole("combobox"));

    await waitFor(() => {
      expect(screen.getByText("Alice Johnson")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Alice Johnson"));

    expect(onChange).toHaveBeenCalledWith("emp-1", {
      value: "emp-1",
      label: "Alice Johnson",
      sublabel: "Engineering",
    });
  });

  it("debounces search input and queries server with search text", async () => {
    const searchMockQuery = vi.fn().mockImplementation((search: string) => {
      if (search === "Bob") {
        return Promise.resolve({
          data: [{ value: "emp-2", label: "Bob Smith" }],
          total: 1,
          page: 1,
          limit: 10,
          totalPages: 1,
        });
      }
      return Promise.resolve({
        data: [],
        total: 0,
        page: 1,
        limit: 10,
        totalPages: 0,
      });
    });

    render(
      <SearchablePaginatedSelect
        placeholder="Select employee..."
        onChange={vi.fn()}
        queryFn={searchMockQuery}
      />,
    );

    fireEvent.click(screen.getByRole("combobox"));

    const input = screen.getByPlaceholderText("Type to search...");
    fireEvent.change(input, { target: { value: "Bob" } });

    await waitFor(
      () => {
        expect(searchMockQuery).toHaveBeenCalledWith("Bob", 1, 20);
        expect(screen.getByText("Bob Smith")).toBeInTheDocument();
      },
      { timeout: 1000 },
    );
  });
});

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { PaginationControls } from "./PaginationControls";

describe("PaginationControls Component", () => {
  it("renders page summary and navigation buttons correctly", () => {
    const onPageChange = vi.fn();
    render(
      <PaginationControls
        page={1}
        limit={25}
        total={100}
        totalPages={4}
        onPageChange={onPageChange}
      />,
    );

    expect(screen.getByTestId("pagination-summary")).toHaveTextContent("Showing 1 to 25 of 100 records");
    expect(screen.getByTestId("pagination-prev")).toBeDisabled();
    expect(screen.getByTestId("pagination-next")).not.toBeDisabled();
  });

  it("calls onPageChange when Next or Prev are clicked", () => {
    const onPageChange = vi.fn();
    render(
      <PaginationControls
        page={2}
        limit={25}
        total={100}
        totalPages={4}
        onPageChange={onPageChange}
      />,
    );

    fireEvent.click(screen.getByTestId("pagination-next"));
    expect(onPageChange).toHaveBeenCalledWith(3);

    fireEvent.click(screen.getByTestId("pagination-prev"));
    expect(onPageChange).toHaveBeenCalledWith(1);
  });

  it("disables Next on the final page", () => {
    const onPageChange = vi.fn();
    render(
      <PaginationControls
        page={4}
        limit={25}
        total={100}
        totalPages={4}
        onPageChange={onPageChange}
      />,
    );

    expect(screen.getByTestId("pagination-next")).toBeDisabled();
  });

  it("handles zero total records gracefully", () => {
    render(
      <PaginationControls
        page={1}
        limit={25}
        total={0}
        totalPages={0}
        onPageChange={vi.fn()}
      />,
    );

    expect(screen.getByTestId("pagination-summary")).toHaveTextContent("No records to display");
    expect(screen.getByTestId("pagination-prev")).toBeDisabled();
    expect(screen.getByTestId("pagination-next")).toBeDisabled();
  });

  it("triggers onPageSizeChange when page size dropdown changes", () => {
    const onPageSizeChange = vi.fn();
    render(
      <PaginationControls
        page={1}
        limit={25}
        total={100}
        totalPages={4}
        onPageChange={vi.fn()}
        onPageSizeChange={onPageSizeChange}
      />,
    );

    const select = screen.getByLabelText("Rows per page");
    fireEvent.change(select, { target: { value: "50" } });
    expect(onPageSizeChange).toHaveBeenCalledWith(50);
  });
});

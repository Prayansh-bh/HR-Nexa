import React from "react";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { Button } from "./button";
import { cn } from "../../lib/utils";

export interface PaginationControlsProps {
  page?: number;
  limit?: number;
  total?: number;
  totalPages: number;
  currentPage?: number;
  pageSize?: number;
  totalItems?: number;
  pageSizeOptions?: number[];
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  isLoading?: boolean;
  disabled?: boolean;
  className?: string;
  showPageSize?: boolean;
  showFirstLast?: boolean;
}

export const PaginationControls: React.FC<PaginationControlsProps> = ({
  page,
  limit,
  total,
  totalPages,
  currentPage,
  pageSize,
  totalItems,
  pageSizeOptions = [10, 25, 50, 100],
  onPageChange,
  onPageSizeChange,
  isLoading = false,
  disabled = false,
  className,
  showPageSize = true,
  showFirstLast = false,
}) => {
  const actualPage = page ?? currentPage ?? 1;
  const actualLimit = limit ?? pageSize ?? 25;
  const actualTotal = total ?? totalItems ?? 0;

  const isPreviousDisabled = actualPage <= 1 || isLoading || disabled;
  const isNextDisabled = actualPage >= totalPages || totalPages === 0 || isLoading || disabled;

  // Calculate visible range
  const startItem = actualTotal === 0 ? 0 : (actualPage - 1) * actualLimit + 1;
  const endItem = Math.min(actualPage * actualLimit, actualTotal);

  // Generate page numbers with smart ellipsis
  const getPageNumbers = () => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const pages: (number | "ellipsis-start" | "ellipsis-end")[] = [];

    if (actualPage <= 4) {
      for (let i = 1; i <= 5; i++) pages.push(i);
      pages.push("ellipsis-end");
      pages.push(totalPages);
    } else if (actualPage >= totalPages - 3) {
      pages.push(1);
      pages.push("ellipsis-start");
      for (let i = totalPages - 4; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      pages.push("ellipsis-start");
      pages.push(actualPage - 1);
      pages.push(actualPage);
      pages.push(actualPage + 1);
      pages.push("ellipsis-end");
      pages.push(totalPages);
    }

    return pages;
  };

  const pageNumbers = getPageNumbers();

  return (
    <nav
      role="navigation"
      aria-label="Pagination Navigation"
      className={cn(
        "flex flex-wrap items-center justify-between gap-4 py-3 text-sm text-slate-600 dark:text-slate-300",
        className,
      )}
    >
      {/* Left: Summary text */}
      <div className="flex items-center gap-2" data-testid="pagination-summary">
        {total === 0 ? (
          <span>No records to display</span>
        ) : (
          <span>
            Showing <strong className="font-semibold text-slate-900 dark:text-white">{startItem}</strong> to{" "}
            <strong className="font-semibold text-slate-900 dark:text-white">{endItem}</strong> of{" "}
            <strong className="font-semibold text-slate-900 dark:text-white">{total}</strong> records
          </span>
        )}
      </div>

      {/* Right: Controls */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Page size dropdown */}
        {showPageSize && onPageSizeChange && (
          <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            <label htmlFor="pagination-page-size" className="sr-only">
              Rows per page
            </label>
            <span>Rows:</span>
            <select
              id="pagination-page-size"
              aria-label="Rows per page"
              value={limit}
              disabled={isLoading || disabled}
              onChange={(e) => {
                const newSize = Number(e.target.value);
                if (newSize > 0) {
                  onPageSizeChange(newSize);
                }
              }}
              className="h-8 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Page navigation buttons */}
        <div className="flex items-center gap-1">
          {showFirstLast && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0"
              disabled={isPreviousDisabled}
              onClick={() => onPageChange(1)}
              aria-label="Go to first page"
            >
              <ChevronsLeft className="h-4 w-4" />
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            className="h-8 px-2.5 gap-1"
            disabled={isPreviousDisabled}
            onClick={() => onPageChange(actualPage - 1)}
            aria-label="Go to previous page"
            data-testid="pagination-prev"
          >
            <ChevronLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Prev</span>
          </Button>

          {/* Page numbers */}
          <div className="flex items-center gap-1" data-testid="pagination-numbers">
            {pageNumbers.map((p, idx) => {
              if (p === "ellipsis-start" || p === "ellipsis-end") {
                return (
                  <span
                    key={`ellipsis-${idx}`}
                    aria-hidden="true"
                    className="flex h-8 w-6 items-center justify-center text-xs text-slate-400"
                  >
                    …
                  </span>
                );
              }

              const isCurrent = p === actualPage;
              return (
                <Button
                  key={p}
                  variant={isCurrent ? "default" : "outline"}
                  size="sm"
                  className={cn(
                    "h-8 w-8 p-0 text-xs font-medium",
                    isCurrent
                      ? "bg-indigo-600 text-white hover:bg-indigo-700 dark:bg-indigo-500"
                      : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800",
                  )}
                  disabled={isLoading || disabled}
                  onClick={() => onPageChange(p)}
                  aria-label={`Page ${p}`}
                  aria-current={isCurrent ? "page" : undefined}
                >
                  {p}
                </Button>
              );
            })}
          </div>

          <Button
            variant="outline"
            size="sm"
            className="h-8 px-2.5 gap-1"
            disabled={isNextDisabled}
            onClick={() => onPageChange(actualPage + 1)}
            aria-label="Go to next page"
            data-testid="pagination-next"
          >
            <span className="hidden sm:inline">Next</span>
            <ChevronRight className="h-4 w-4" />
          </Button>

          {showFirstLast && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0"
              disabled={isNextDisabled}
              onClick={() => onPageChange(totalPages)}
              aria-label="Go to last page"
            >
              <ChevronsRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </nav>
  );
};

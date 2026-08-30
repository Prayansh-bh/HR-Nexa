import React, { useState, useEffect, useRef, useCallback } from "react";
import { Check, ChevronsUpDown, Loader2, Search } from "lucide-react";
import { Button } from "./button";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { cn } from "../../lib/utils";
import { PaginatedResponse } from "../../types/pagination";

export interface SelectOption {
  value: string;
  label: string;
  sublabel?: string;
  disabled?: boolean;
}

export interface SearchablePaginatedSelectProps {
  value?: string;
  onChange: (value: string, selectedOption?: SelectOption) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  className?: string;
  queryFn: (search: string, page: number, limit: number) => Promise<PaginatedResponse<SelectOption>>;
  pageSize?: number;
  initialSelectedOption?: SelectOption;
}

export const SearchablePaginatedSelect: React.FC<SearchablePaginatedSelectProps> = ({
  value,
  onChange,
  placeholder = "Select an item...",
  searchPlaceholder = "Type to search...",
  emptyText = "No items found.",
  disabled = false,
  className,
  queryFn,
  pageSize = 20,
  initialSelectedOption,
}) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<SelectOption[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedLabel, setSelectedLabel] = useState<string>(
    initialSelectedOption?.label || "",
  );

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1); // Reset page on query change
    }, 300);
    return () => clearTimeout(handler);
  }, [search]);

  // Load items when popover opens, search changes, or page changes
  const fetchItems = useCallback(
    async (currentSearch: string, currentPage: number) => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await queryFn(currentSearch, currentPage, pageSize);
        if (currentPage === 1) {
          setItems(res.data || []);
        } else {
          setItems((prev) => [...prev, ...(res.data || [])]);
        }
        setTotal(res.total || 0);
        setTotalPages(res.totalPages || 0);
      } catch (err: any) {
        setError(err.message || "Failed to load options");
      } finally {
        setIsLoading(false);
      }
    },
    [queryFn, pageSize],
  );

  useEffect(() => {
    if (open) {
      fetchItems(debouncedSearch, page);
    }
  }, [open, debouncedSearch, page, fetchItems]);

  // Keep selected option label up to date
  useEffect(() => {
    if (value) {
      const match = items.find((i) => i.value === value);
      if (match) {
        setSelectedLabel(match.label);
      } else if (initialSelectedOption && initialSelectedOption.value === value) {
        setSelectedLabel(initialSelectedOption.label);
      }
    } else {
      setSelectedLabel("");
    }
  }, [value, items, initialSelectedOption]);

  const handleSelect = (item: SelectOption) => {
    if (item.disabled) return;
    onChange(item.value, item);
    setSelectedLabel(item.label);
    setOpen(false);
  };

  const hasMore = page < totalPages;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "w-full justify-between font-normal text-left truncate bg-white dark:bg-slate-900",
            !value && "text-muted-foreground",
            className,
          )}
        >
          <span className="truncate">{selectedLabel || placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] sm:w-[360px] p-2" align="start">
        {/* Search input */}
        <div className="flex items-center border-b border-slate-200 dark:border-slate-800 pb-2 mb-2 px-1">
          <Search className="h-4 w-4 mr-2 text-slate-400 shrink-0" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full text-sm bg-transparent border-none outline-none focus:ring-0 placeholder:text-slate-400 dark:text-slate-100"
            autoFocus
          />
        </div>

        {/* Options list */}
        <div className="max-h-[220px] overflow-y-auto space-y-0.5">
          {items.length === 0 && !isLoading && !error && (
            <div className="py-6 text-center text-xs text-slate-500">
              {emptyText}
            </div>
          )}

          {error && (
            <div className="py-4 text-center text-xs text-rose-500">
              {error}
            </div>
          )}

          {items.map((item) => {
            const isSelected = item.value === value;
            return (
              <div
                key={item.value}
                onClick={() => handleSelect(item)}
                className={cn(
                  "flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs cursor-pointer select-none transition-colors",
                  item.disabled
                    ? "opacity-50 cursor-not-allowed text-slate-400"
                    : isSelected
                    ? "bg-indigo-50 text-indigo-900 font-medium dark:bg-indigo-950 dark:text-indigo-200"
                    : "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200",
                )}
              >
                <div className="flex flex-col truncate pr-2">
                  <span className="truncate">{item.label}</span>
                  {item.sublabel && (
                    <span className="text-[10px] text-slate-400 truncate">
                      {item.sublabel}
                    </span>
                  )}
                </div>
                {isSelected && (
                  <Check className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400 shrink-0 ml-1" />
                )}
              </div>
            );
          })}

          {/* Loading indicator */}
          {isLoading && (
            <div className="flex items-center justify-center py-3 text-xs text-slate-400 gap-1.5">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-500" />
              <span>Loading options...</span>
            </div>
          )}

          {/* Load more button */}
          {!isLoading && hasMore && (
            <div className="pt-2 pb-1 border-t border-slate-100 dark:border-slate-800 text-center">
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-xs text-indigo-600 h-7"
                onClick={(e) => {
                  e.stopPropagation();
                  setPage((p) => p + 1);
                }}
              >
                Load more ({items.length} of {total})
              </Button>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};

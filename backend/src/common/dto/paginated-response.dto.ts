export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export function createPaginatedResponse<T>(
  data: T[],
  total: number,
  page: number,
  limit: number,
): PaginatedResponse<T> {
  const safeLimit = Number(limit) > 0 ? Math.floor(Number(limit)) : 50;
  const safePage = Number(page) > 0 ? Math.floor(Number(page)) : 1;
  const safeTotal = Number(total) >= 0 ? Math.floor(Number(total)) : 0;
  const totalPages = Math.ceil(safeTotal / safeLimit) || 0;

  return {
    data: Array.isArray(data) ? data : [],
    total: safeTotal,
    page: safePage,
    limit: safeLimit,
    totalPages,
  };
}

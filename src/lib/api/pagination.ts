import type { PaginationParams, PaginatedResult, PaginationMeta } from "./types";

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;

/**
 * Parse pagination params from URL search params.
 */
export function parsePagination(searchParams: URLSearchParams): Required<PaginationParams> {
  const page = Math.max(1, parseInt(searchParams.get("page") ?? `${DEFAULT_PAGE}`, 10) || DEFAULT_PAGE);
  const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(searchParams.get("limit") ?? `${DEFAULT_LIMIT}`, 10) || DEFAULT_LIMIT));
  return { page, limit };
}

/**
 * Build a paginated result from items and total count.
 */
export function buildPaginatedResult<T>(
  items: T[],
  total: number,
  page: number,
  limit: number
): PaginatedResult<T> {
  const meta: PaginationMeta = {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  };
  return { items, meta };
}

/**
 * Calculate Prisma skip value from page/limit.
 */
export function paginationToSkip(page: number, limit: number): number {
  return (page - 1) * limit;
}

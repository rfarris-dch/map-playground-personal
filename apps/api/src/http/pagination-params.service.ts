import type {
  ResolvePaginationOptions,
  ResolvePaginationResult,
} from "./pagination-params.service.types";

export type { PaginationParams } from "./pagination-params.service.types";

function parseInteger(value: string): number | null {
  if (value.trim().length === 0) {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    return null;
  }

  return parsed;
}

export function resolvePaginationParams(
  rawPage: string | undefined,
  rawPageSize: string | undefined,
  options: ResolvePaginationOptions
): ResolvePaginationResult {
  const pageValue = typeof rawPage === "string" ? parseInteger(rawPage) : 0;
  if (pageValue === null || pageValue < 0) {
    return {
      ok: false,
      message: "page query param must be an integer >= 0",
    };
  }

  const parsedPageSize = typeof rawPageSize === "string" ? parseInteger(rawPageSize) : null;
  if (parsedPageSize === null && typeof rawPageSize === "string") {
    return {
      ok: false,
      message: "pageSize query param must be an integer >= 1",
    };
  }

  const requestedPageSize = parsedPageSize ?? options.defaultPageSize;
  if (requestedPageSize <= 0) {
    return {
      ok: false,
      message: "pageSize query param must be an integer >= 1",
    };
  }

  const pageSize = Math.min(requestedPageSize, options.maxPageSize);
  const offset = pageValue * pageSize;

  return {
    ok: true,
    value: {
      page: pageValue,
      pageSize,
      offset,
    },
  };
}

export function totalPages(totalCount: number, pageSize: number): number {
  if (pageSize <= 0) {
    return 0;
  }

  return Math.ceil(totalCount / pageSize);
}

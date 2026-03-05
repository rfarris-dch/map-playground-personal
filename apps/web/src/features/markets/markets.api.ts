import { buildMarketsRoute, MarketsTableResponseSchema } from "@map-migration/contracts";
import type { MarketsTableRequest, MarketsTableResult } from "@/features/markets/markets.types";
import { apiGetJson } from "@/lib/api-client";

export function fetchMarketsTable(request: MarketsTableRequest): Promise<MarketsTableResult> {
  const requestInit: RequestInit = {};
  if (request.signal) {
    requestInit.signal = request.signal;
  }

  return apiGetJson(
    buildMarketsRoute({
      page: request.page,
      pageSize: request.pageSize,
      sortBy: request.sortBy,
      sortOrder: request.sortOrder,
    }),
    MarketsTableResponseSchema,
    requestInit
  );
}

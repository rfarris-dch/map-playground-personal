import { buildMarketsRoute } from "@map-migration/http-contracts/api-routes";
import { MarketsTableResponseSchema } from "@map-migration/http-contracts/table-contracts";
import { apiGetJson } from "@map-migration/core-runtime/api";
import type { MarketsTableRequest, MarketsTableResult } from "@/features/markets/markets.types";
import { buildApiRequestInit } from "@/lib/api/api-request-init.service";

export function fetchMarketsTable(request: MarketsTableRequest): Promise<MarketsTableResult> {
  return apiGetJson(
    buildMarketsRoute({
      page: request.page,
      pageSize: request.pageSize,
      sortBy: request.sortBy,
      sortOrder: request.sortOrder,
    }),
    MarketsTableResponseSchema,
    buildApiRequestInit({
      signal: request.signal,
    })
  );
}

import { buildMarketsRoute } from "@map-migration/http-contracts/api-routes";
import { MarketsTableResponseSchema } from "@map-migration/http-contracts/table-contracts";
import type { MarketsTableRequest, MarketsTableResult } from "@/features/markets/markets.types";
import { createTableFetcher } from "@/lib/api/table-fetcher.service";

const marketsTableFetcher = createTableFetcher((request: MarketsTableRequest) => {
  return buildMarketsRoute({
    page: request.page,
    pageSize: request.pageSize,
    sortBy: request.sortBy,
    sortOrder: request.sortOrder,
  });
}, MarketsTableResponseSchema);

export function fetchMarketsTable(request: MarketsTableRequest): Promise<MarketsTableResult> {
  return marketsTableFetcher(request);
}

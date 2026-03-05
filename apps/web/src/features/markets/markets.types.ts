import type { MarketSortBy, MarketsTableResponse, SortDirection } from "@map-migration/contracts";
import type { ApiResult } from "@/lib/api-client";

export interface MarketsTableRequest {
  readonly page: number;
  readonly pageSize: number;
  readonly signal?: AbortSignal;
  readonly sortBy: MarketSortBy;
  readonly sortOrder: SortDirection;
}

export type MarketsTableResult = ApiResult<MarketsTableResponse>;

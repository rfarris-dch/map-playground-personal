import type { ApiResult } from "@map-migration/core-runtime/api";
import type {
  MarketSortBy,
  MarketsTableResponse,
  SortDirection,
} from "@map-migration/http-contracts/table-contracts";

export interface MarketsTableRequest {
  readonly page: number;
  readonly pageSize: number;
  readonly signal?: AbortSignal;
  readonly sortBy: MarketSortBy;
  readonly sortOrder: SortDirection;
}

export type MarketsTableResult = ApiResult<MarketsTableResponse>;

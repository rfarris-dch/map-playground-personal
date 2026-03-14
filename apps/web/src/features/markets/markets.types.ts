import type { ApiResult } from "@map-migration/core-runtime/api";
import type {
  MarketSortBy,
  MarketsTableResponse,
} from "@map-migration/http-contracts/table-contracts";
import type { PagedSortedRequest } from "@/lib/api/table-fetcher.service";

export type MarketsTableRequest = PagedSortedRequest<MarketSortBy>;

export type MarketsTableResult = ApiResult<MarketsTableResponse>;

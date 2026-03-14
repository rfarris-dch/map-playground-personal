import type { ApiResult } from "@map-migration/core-runtime/api";
import type {
  ProviderSortBy,
  ProvidersTableResponse,
} from "@map-migration/http-contracts/table-contracts";
import type { PagedSortedRequest } from "@/lib/api/table-fetcher.service";

export type ProvidersTableRequest = PagedSortedRequest<ProviderSortBy>;

export type ProvidersTableResult = ApiResult<ProvidersTableResponse>;

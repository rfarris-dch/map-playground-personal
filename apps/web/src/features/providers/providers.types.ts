import type { ProviderSortBy, ProvidersTableResponse, SortDirection } from "@map-migration/http-contracts";
import type { ApiResult } from "@map-migration/core-runtime/api";

export interface ProvidersTableRequest {
  readonly page: number;
  readonly pageSize: number;
  readonly signal?: AbortSignal;
  readonly sortBy: ProviderSortBy;
  readonly sortOrder: SortDirection;
}

export type ProvidersTableResult = ApiResult<ProvidersTableResponse>;

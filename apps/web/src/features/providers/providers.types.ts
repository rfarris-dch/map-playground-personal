import type {
  ProviderSortBy,
  ProvidersTableResponse,
  SortDirection,
} from "@map-migration/contracts";
import type { ApiResult } from "@/lib/api-client";

export interface ProvidersTableRequest {
  readonly page: number;
  readonly pageSize: number;
  readonly signal?: AbortSignal;
  readonly sortBy: ProviderSortBy;
  readonly sortOrder: SortDirection;
}

export type ProvidersTableResult = ApiResult<ProvidersTableResponse>;

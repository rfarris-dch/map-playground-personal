import type { FacilityPerspective } from "@map-migration/geo-kernel";
import type { FacilitiesTableResponse, FacilitySortBy, SortDirection } from "@map-migration/http-contracts";
import type { ApiResult } from "@map-migration/core-runtime/api";

export interface FacilitiesTableRequest {
  readonly page: number;
  readonly pageSize: number;
  readonly perspective: FacilityPerspective;
  readonly signal?: AbortSignal;
  readonly sortBy: FacilitySortBy;
  readonly sortOrder: SortDirection;
}

export type FacilitiesTableResult = ApiResult<FacilitiesTableResponse>;

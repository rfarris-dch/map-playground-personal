import type { ApiResult } from "@map-migration/core-runtime/api";
import type { FacilityPerspective } from "@map-migration/geo-kernel/facility-perspective";
import type {
  FacilitiesTableResponse,
  FacilitySortBy,
  SortDirection,
} from "@map-migration/http-contracts/table-contracts";

export interface FacilitiesTableRequest {
  readonly page: number;
  readonly pageSize: number;
  readonly perspective: FacilityPerspective;
  readonly signal?: AbortSignal;
  readonly sortBy: FacilitySortBy;
  readonly sortOrder: SortDirection;
}

export type FacilitiesTableResult = ApiResult<FacilitiesTableResponse>;

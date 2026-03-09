import type {
  FacilitiesTableResponse,
  FacilityPerspective,
  FacilitySortBy,
  SortDirection,
} from "@map-migration/contracts";
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

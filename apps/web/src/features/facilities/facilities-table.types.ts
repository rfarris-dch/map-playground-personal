import type {
  FacilitiesTableResponse,
  FacilityPerspective,
  FacilitySortBy,
  SortDirection,
} from "@map-migration/contracts";
import type { ApiResult } from "@/lib/api-client";

export interface FacilitiesTableRequest {
  readonly page: number;
  readonly pageSize: number;
  readonly perspective: FacilityPerspective;
  readonly signal?: AbortSignal;
  readonly sortBy: FacilitySortBy;
  readonly sortOrder: SortDirection;
}

export type FacilitiesTableResult = ApiResult<FacilitiesTableResponse>;

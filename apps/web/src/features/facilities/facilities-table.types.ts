import type { ApiResult } from "@map-migration/core-runtime/api";
import type { FacilityPerspective } from "@map-migration/geo-kernel/facility-perspective";
import type {
  FacilitiesTableResponse,
  FacilitySortBy,
} from "@map-migration/http-contracts/table-contracts";
import type { PagedSortedRequest } from "@/lib/api/table-fetcher.service";

export type FacilitiesTableRequest = PagedSortedRequest<
  FacilitySortBy,
  { readonly perspective: FacilityPerspective }
>;

export type FacilitiesTableResult = ApiResult<FacilitiesTableResponse>;

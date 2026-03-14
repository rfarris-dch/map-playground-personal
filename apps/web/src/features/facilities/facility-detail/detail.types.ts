import type { FacilityPerspective } from "@map-migration/geo-kernel";
import type { FacilitiesDetailResponse } from "@map-migration/http-contracts";
import type { ApiResult } from "@map-migration/core-runtime/api";
import type { SelectedFacilityRef } from "@/features/facilities/facilities.types";

export type FacilityDetailResult = ApiResult<FacilitiesDetailResponse>;

export interface FacilityDetailPayload {
  readonly requestId: string;
  readonly response: FacilitiesDetailResponse;
}

export interface FacilityDetailRequest extends SelectedFacilityRef {
  readonly signal?: AbortSignal;
}

export type FacilityDetailQueryKey = readonly [
  "facility-detail",
  FacilityPerspective | null,
  string | null,
  number,
];

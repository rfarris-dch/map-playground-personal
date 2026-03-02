import type { FacilitiesDetailResponse } from "@map-migration/contracts";
import type { ApiResult } from "@/lib/api-client";
import type { SelectedFacilityRef } from "../facilities.types";

export type FacilityDetailResult = ApiResult<FacilitiesDetailResponse>;

export interface FacilityDetailPayload {
  readonly requestId: string;
  readonly response: FacilitiesDetailResponse;
}

export interface FacilityDetailRequest extends SelectedFacilityRef {
  readonly signal?: AbortSignal;
}

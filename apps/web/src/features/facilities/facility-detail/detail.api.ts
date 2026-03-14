import { buildFacilityDetailRoute } from "@map-migration/http-contracts/api-routes";
import {
  type FacilitiesDetailResponse,
  FacilitiesDetailResponseSchema,
} from "@map-migration/http-contracts/facilities-http";
import type {
  FacilityDetailRequest,
  FacilityDetailResult,
} from "@/features/facilities/facility-detail/detail.types";
import { buildApiRequestInit } from "@/lib/api/api-request-init.service";
import { createTypedGetFetcher } from "@/lib/api/typed-get-fetcher.service";

const facilityDetailFetcher = createTypedGetFetcher<
  FacilityDetailRequest,
  FacilitiesDetailResponse
>({
  buildRequestInit(request) {
    return buildApiRequestInit({
      signal: request.signal,
    });
  },
  buildRoute(request) {
    return buildFacilityDetailRoute(request.facilityId, {
      perspective: request.perspective,
    });
  },
  schema: FacilitiesDetailResponseSchema,
});

export function fetchFacilityDetail(request: FacilityDetailRequest): Promise<FacilityDetailResult> {
  return facilityDetailFetcher(request);
}

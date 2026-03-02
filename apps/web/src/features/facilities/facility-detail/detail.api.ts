import { buildFacilityDetailRoute, FacilitiesDetailResponseSchema } from "@map-migration/contracts";
import { apiGetJson } from "@/lib/api-client";
import type { FacilityDetailRequest, FacilityDetailResult } from "./detail.types";

export function fetchFacilityDetail(request: FacilityDetailRequest): Promise<FacilityDetailResult> {
  const requestInit: RequestInit = {};
  if (request.signal) {
    requestInit.signal = request.signal;
  }
  const params = new URLSearchParams();
  params.set("perspective", request.perspective);
  const url = `${buildFacilityDetailRoute(request.facilityId)}?${params.toString()}`;

  return apiGetJson(url, FacilitiesDetailResponseSchema, requestInit);
}

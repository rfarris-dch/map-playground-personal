import {
  ApiHeaders,
  buildParcelDetailRoute,
  ParcelDetailResponseSchema,
} from "@map-migration/contracts";
import type {
  ParcelDetailRequest,
  ParcelDetailResult,
} from "@/features/parcels/parcel-detail/detail.types";
import { apiGetJson } from "@/lib/api-client";

export function fetchParcelDetail(request: ParcelDetailRequest): Promise<ParcelDetailResult> {
  const requestInit: RequestInit = {};
  if (
    typeof request.expectedIngestionRunId === "string" &&
    request.expectedIngestionRunId.trim().length > 0
  ) {
    requestInit.headers = {
      [ApiHeaders.parcelIngestionRunId]: request.expectedIngestionRunId.trim(),
    };
  }

  if (request.signal) {
    requestInit.signal = request.signal;
  }

  return apiGetJson(
    buildParcelDetailRoute(request.parcelId, {
      profile: request.profile,
      includeGeometry: request.includeGeometry,
    }),
    ParcelDetailResponseSchema,
    requestInit
  );
}

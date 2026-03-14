import { buildParcelDetailRoute } from "@map-migration/http-contracts/api-routes";
import { ParcelDetailResponseSchema } from "@map-migration/http-contracts/parcels-http";
import { apiGetJson } from "@map-migration/core-runtime/api";
import type {
  ParcelDetailRequest,
  ParcelDetailResult,
} from "@/features/parcels/parcel-detail/detail.types";
import {
  buildApiRequestInit,
  withParcelIngestionRunIdHeader,
} from "@/lib/api/api-request-init.service";

export function fetchParcelDetail(request: ParcelDetailRequest): Promise<ParcelDetailResult> {
  return apiGetJson(
    buildParcelDetailRoute(request.parcelId, {
      profile: request.profile,
      includeGeometry: request.includeGeometry,
    }),
    ParcelDetailResponseSchema,
    withParcelIngestionRunIdHeader(
      buildApiRequestInit({
        signal: request.signal,
      }),
      request.expectedIngestionRunId
    )
  );
}

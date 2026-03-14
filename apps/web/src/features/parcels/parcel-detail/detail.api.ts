import { buildParcelDetailRoute } from "@map-migration/http-contracts/api-routes";
import {
  type ParcelDetailResponse,
  ParcelDetailResponseSchema,
} from "@map-migration/http-contracts/parcels-http";
import type {
  ParcelDetailRequest,
  ParcelDetailResult,
} from "@/features/parcels/parcel-detail/detail.types";
import {
  buildApiRequestInit,
  withParcelIngestionRunIdHeader,
} from "@/lib/api/api-request-init.service";
import { createTypedGetFetcher } from "@/lib/api/typed-get-fetcher.service";

const parcelDetailFetcher = createTypedGetFetcher<ParcelDetailRequest, ParcelDetailResponse>({
  buildRequestInit(request) {
    return withParcelIngestionRunIdHeader(
      buildApiRequestInit({
        signal: request.signal,
      }),
      request.expectedIngestionRunId
    );
  },
  buildRoute(request) {
    return buildParcelDetailRoute(request.parcelId, {
      includeGeometry: request.includeGeometry,
      profile: request.profile,
    });
  },
  schema: ParcelDetailResponseSchema,
});

export function fetchParcelDetail(request: ParcelDetailRequest): Promise<ParcelDetailResult> {
  return parcelDetailFetcher(request);
}

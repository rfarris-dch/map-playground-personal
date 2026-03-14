import { apiGetJsonEffect } from "@map-migration/core-runtime/api";
import { buildFacilitiesBboxRoute } from "@map-migration/http-contracts/api-routes";
import { FacilitiesFeatureCollectionSchema } from "@map-migration/http-contracts/facilities-http";
import type { FacilitiesBboxRequest } from "@/features/facilities/facilities.types";
import { buildApiRequestInit } from "@/lib/api/api-request-init.service";

export function fetchFacilitiesByBboxEffect(args: FacilitiesBboxRequest) {
  return apiGetJsonEffect(
    buildFacilitiesBboxRoute({
      bbox: args.bbox,
      perspective: args.perspective,
      limit: args.limit,
    }),
    FacilitiesFeatureCollectionSchema,
    buildApiRequestInit()
  );
}

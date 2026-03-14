import { buildFacilitiesBboxRoute, FacilitiesFeatureCollectionSchema } from "@map-migration/http-contracts";
import { apiGetJsonEffect } from "@map-migration/core-runtime/api";
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

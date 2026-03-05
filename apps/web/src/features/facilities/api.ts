import {
  buildFacilitiesBboxRoute,
  FacilitiesFeatureCollectionSchema,
} from "@map-migration/contracts";
import type {
  FacilitiesBboxRequest,
  FacilitiesFetchResult,
} from "@/features/facilities/facilities.types";
import { apiGetJson } from "@/lib/api-client";

export function fetchFacilitiesByBbox(args: FacilitiesBboxRequest): Promise<FacilitiesFetchResult> {
  const requestInit: RequestInit = {};
  if (args.signal) {
    requestInit.signal = args.signal;
  }

  return apiGetJson(
    buildFacilitiesBboxRoute({
      bbox: args.bbox,
      perspective: args.perspective,
      limit: args.limit,
    }),
    FacilitiesFeatureCollectionSchema,
    requestInit
  );
}

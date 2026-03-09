import {
  buildFacilitiesBboxRoute,
  FacilitiesFeatureCollectionSchema,
} from "@map-migration/contracts";
import { apiGetJson } from "@map-migration/core-runtime/api";
import type {
  FacilitiesBboxRequest,
  FacilitiesFetchResult,
} from "@/features/facilities/facilities.types";

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

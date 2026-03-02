import {
  ApiRoutes,
  FacilitiesFeatureCollectionSchema,
  formatBboxParam,
} from "@map-migration/contracts";
import { apiGetJson } from "@/lib/api-client";
import type { FacilitiesBboxRequest, FacilitiesFetchResult } from "./facilities.types";

export function fetchFacilitiesByBbox(args: FacilitiesBboxRequest): Promise<FacilitiesFetchResult> {
  const params = new URLSearchParams();
  params.set("bbox", formatBboxParam(args.bbox));
  params.set("perspective", args.perspective);
  if (typeof args.limit === "number") {
    params.set("limit", String(args.limit));
  }

  const requestInit: RequestInit = {};
  if (args.signal) {
    requestInit.signal = args.signal;
  }

  const url = `${ApiRoutes.facilities}?${params.toString()}`;
  return apiGetJson(url, FacilitiesFeatureCollectionSchema, requestInit);
}

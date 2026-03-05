import {
  BoundaryPowerFeatureCollectionSchema,
  type BoundaryPowerLevel,
  buildBoundaryPowerRoute,
} from "@map-migration/contracts";
import { apiGetJson } from "@/lib/api-client";
import type { BoundaryPowerFetchResult } from "./boundaries.types";

export function fetchBoundaryPower(
  level: BoundaryPowerLevel,
  init: RequestInit = {}
): Promise<BoundaryPowerFetchResult> {
  return apiGetJson(buildBoundaryPowerRoute(level), BoundaryPowerFeatureCollectionSchema, init);
}

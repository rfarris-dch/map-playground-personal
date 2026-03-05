import {
  BoundaryPowerFeatureCollectionSchema,
  type BoundaryPowerLevel,
  buildBoundaryPowerRoute,
} from "@map-migration/contracts";
import type { BoundaryPowerFetchResult } from "@/features/boundaries/boundaries.types";
import { apiGetJson } from "@/lib/api-client";

export function fetchBoundaryPower(
  level: BoundaryPowerLevel,
  init: RequestInit = {}
): Promise<BoundaryPowerFetchResult> {
  return apiGetJson(buildBoundaryPowerRoute(level), BoundaryPowerFeatureCollectionSchema, init);
}

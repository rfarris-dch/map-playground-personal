import {
  BoundaryPowerFeatureCollectionSchema,
  type BoundaryPowerLevel,
  buildBoundaryPowerRoute,
} from "@map-migration/contracts";
import { apiGetJson } from "@map-migration/core-runtime/api";
import type { BoundaryPowerFetchResult } from "@/features/boundaries/boundaries.types";

export function fetchBoundaryPower(
  level: BoundaryPowerLevel,
  init: RequestInit = {}
): Promise<BoundaryPowerFetchResult> {
  return apiGetJson(buildBoundaryPowerRoute(level), BoundaryPowerFeatureCollectionSchema, init);
}

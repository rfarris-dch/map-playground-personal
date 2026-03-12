import {
  BoundaryPowerFeatureCollectionSchema,
  type BoundaryPowerLevel,
  buildBoundaryPowerRoute,
} from "@map-migration/contracts";
import { apiGetJsonEffect } from "@map-migration/core-runtime/api";

export function fetchBoundaryPowerEffect(level: BoundaryPowerLevel, init: RequestInit = {}) {
  return apiGetJsonEffect(
    buildBoundaryPowerRoute(level),
    BoundaryPowerFeatureCollectionSchema,
    init
  );
}

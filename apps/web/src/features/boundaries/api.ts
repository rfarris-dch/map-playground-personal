import { apiRequestJsonEffect } from "@map-migration/core-runtime/api";
import { buildBoundaryPowerRoute } from "@map-migration/http-contracts/api-routes";
import {
  BoundaryPowerFeatureCollectionSchema,
  type BoundaryPowerLevel,
} from "@map-migration/http-contracts/boundaries-http";

export function fetchBoundaryPowerEffect(level: BoundaryPowerLevel, init: RequestInit = {}) {
  return apiRequestJsonEffect(
    buildBoundaryPowerRoute(level),
    BoundaryPowerFeatureCollectionSchema,
    init
  );
}

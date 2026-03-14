import { apiGetJsonEffect } from "@map-migration/core-runtime/api";
import { buildBoundaryPowerRoute } from "@map-migration/http-contracts/api-routes";
import {
  BoundaryPowerFeatureCollectionSchema,
  type BoundaryPowerLevel,
} from "@map-migration/http-contracts/boundaries-http";

export function fetchBoundaryPowerEffect(level: BoundaryPowerLevel, init: RequestInit = {}) {
  return apiGetJsonEffect(
    buildBoundaryPowerRoute(level),
    BoundaryPowerFeatureCollectionSchema,
    init
  );
}

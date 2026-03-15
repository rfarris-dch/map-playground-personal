import { apiRequestJsonEffect } from "@map-migration/core-runtime/api";
import { buildMarketBoundariesRoute } from "@map-migration/http-contracts/api-routes";
import {
  MarketBoundaryFeatureCollectionSchema,
  type MarketBoundaryLevel,
} from "@map-migration/http-contracts/market-boundaries-http";

export function fetchMarketBoundariesEffect(level: MarketBoundaryLevel, init: RequestInit = {}) {
  return apiRequestJsonEffect(
    buildMarketBoundariesRoute(level),
    MarketBoundaryFeatureCollectionSchema,
    init
  );
}

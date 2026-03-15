import type { MarketBoundaryFeatureCollection } from "@map-migration/http-contracts/market-boundaries-http";
import type { MarketBoundaryRow } from "@/geo/market-boundaries/market-boundaries.repo";

export type MapFeaturesResult =
  | { readonly features: MarketBoundaryFeatureCollection["features"]; readonly ok: true }
  | { readonly error: unknown; readonly ok: false };

export type QueryRowsResult =
  | { readonly ok: true; readonly rows: readonly MarketBoundaryRow[] }
  | { readonly error: unknown; readonly ok: false };

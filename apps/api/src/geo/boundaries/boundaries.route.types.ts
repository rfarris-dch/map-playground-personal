import type { BoundaryPowerFeatureCollection } from "@map-migration/http-contracts/boundaries-http";
import type { BoundaryPowerRow } from "@/geo/boundaries/boundaries.repo";

export type MapFeaturesResult =
  | { readonly features: BoundaryPowerFeatureCollection["features"]; readonly ok: true }
  | { readonly error: unknown; readonly ok: false };

export type QueryRowsResult =
  | { readonly ok: true; readonly rows: readonly BoundaryPowerRow[] }
  | { readonly error: unknown; readonly ok: false };

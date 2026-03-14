import type { FacilitiesFeatureCollection } from "@map-migration/http-contracts";

export interface BuildFacilityAnchorParcelRequestsArgs {
  readonly colocationFeatures: FacilitiesFeatureCollection["features"];
  readonly hyperscaleFeatures: FacilitiesFeatureCollection["features"];
  readonly pageSize: number;
}

export interface FacilityAnchorCandidate {
  readonly lat: number;
  readonly lng: number;
  readonly score: number;
}

import type { ParcelFeature } from "@map-migration/http-contracts/parcels-http";
import type { LngLat } from "@map-migration/map-engine";

export interface SpatialAnalysisParcelRecord {
  readonly attrs: ParcelFeature["properties"]["attrs"];
  readonly coordinates: LngLat | null;
  readonly geoid: string | null;
  readonly parcelId: string;
  readonly state2: string | null;
}

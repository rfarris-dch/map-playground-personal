import type { FacilitiesFeatureCollection } from "@map-migration/http-contracts/facilities-http";
import type { ParcelsFeatureCollection } from "@map-migration/http-contracts/parcels-http";
import type { LngLat } from "@map-migration/map-engine";

export interface MeasureSelectionSummaryArgs {
  readonly colocationFeatures: FacilitiesFeatureCollection["features"];
  readonly hyperscaleFeatures: FacilitiesFeatureCollection["features"];
  readonly parcelFeatures: ParcelsFeatureCollection["features"];
  readonly parcelNextCursor: string | null;
  readonly parcelTruncated: boolean;
  readonly ring: readonly LngLat[];
}

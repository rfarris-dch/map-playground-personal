import type { FacilitiesFeatureCollection, ParcelsFeatureCollection } from "@map-migration/http-contracts";
import type { LngLat } from "@map-migration/map-engine";

export interface MeasureSelectionSummaryArgs {
  readonly colocationFeatures: FacilitiesFeatureCollection["features"];
  readonly hyperscaleFeatures: FacilitiesFeatureCollection["features"];
  readonly parcelFeatures: ParcelsFeatureCollection["features"];
  readonly parcelNextCursor: string | null;
  readonly parcelTruncated: boolean;
  readonly ring: readonly LngLat[];
}

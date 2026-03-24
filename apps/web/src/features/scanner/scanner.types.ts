import type { FacilitiesFeatureCollection } from "@map-migration/http-contracts/facilities-http";
import type { ParcelsFeatureCollection } from "@map-migration/http-contracts/parcels-http";
import type { SpatialAnalysisSummaryResponse } from "@map-migration/http-contracts/spatial-analysis-summary-http";
import type { SpatialAnalysisFacilityRecord } from "@/features/spatial-analysis/spatial-analysis-facilities.types";
import type { SpatialAnalysisParcelRecord } from "@/features/spatial-analysis/spatial-analysis-parcels.types";
import type { SpatialAnalysisProviderSummaryItem } from "@/features/spatial-analysis/spatial-analysis-provider-summary.types";

type SpatialAnalysisSelectionSummary = SpatialAnalysisSummaryResponse["summary"];

export type ScannerFacility = SpatialAnalysisFacilityRecord;

export type ScannerPerspectiveSummary = SpatialAnalysisSelectionSummary["colocation"];

export interface ScannerProviderSummary extends SpatialAnalysisProviderSummaryItem {}

export interface ScannerParcel extends SpatialAnalysisParcelRecord {}

export type ScannerParcelSelectionSummary = Omit<
  SpatialAnalysisSelectionSummary["parcelSelection"],
  "parcels"
> & {
  readonly parcels: readonly ScannerParcel[];
};

export interface ScannerSummary {
  readonly colocation: SpatialAnalysisSelectionSummary["colocation"];
  readonly countyIds: readonly SpatialAnalysisSelectionSummary["countyIds"][number][];
  readonly facilities: readonly ScannerFacility[];
  readonly hyperscale: SpatialAnalysisSelectionSummary["hyperscale"];
  readonly parcelSelection: ScannerParcelSelectionSummary;
  readonly topColocationProviders: readonly ScannerProviderSummary[];
  readonly topHyperscaleProviders: readonly ScannerProviderSummary[];
  readonly totalCount: SpatialAnalysisSelectionSummary["totalCount"];
}

export interface ScannerInput {
  readonly colocationFeatures: FacilitiesFeatureCollection["features"];
  readonly hyperscaleFeatures: FacilitiesFeatureCollection["features"];
  readonly parcelFeatures: ParcelsFeatureCollection["features"];
  readonly parcelNextCursor: string | null;
  readonly parcelTruncated: boolean;
}

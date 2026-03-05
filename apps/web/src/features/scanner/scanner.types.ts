import type {
  FacilitiesFeatureCollection,
  ParcelsFeatureCollection,
} from "@map-migration/contracts";
import type { SpatialAnalysisFacilityRecord } from "@/features/spatial-analysis/spatial-analysis-facilities.types";
import type { SpatialAnalysisParcelRecord } from "@/features/spatial-analysis/spatial-analysis-parcels.types";
import type { SpatialAnalysisProviderSummaryItem } from "@/features/spatial-analysis/spatial-analysis-provider-summary.types";

export interface ScannerFacility extends SpatialAnalysisFacilityRecord {}

export interface ScannerPerspectiveSummary {
  readonly commissionedPowerMw: number;
  readonly count: number;
  readonly leasedCount: number;
  readonly operationalCount: number;
  readonly plannedCount: number;
  readonly underConstructionCount: number;
  readonly unknownCount: number;
}

export interface ScannerProviderSummary extends SpatialAnalysisProviderSummaryItem {}

export interface ScannerParcel extends SpatialAnalysisParcelRecord {}

export interface ScannerParcelSelectionSummary {
  readonly count: number;
  readonly nextCursor: string | null;
  readonly parcels: readonly ScannerParcel[];
  readonly truncated: boolean;
}

export interface ScannerSummary {
  readonly colocation: ScannerPerspectiveSummary;
  readonly facilities: readonly ScannerFacility[];
  readonly hyperscale: ScannerPerspectiveSummary;
  readonly parcelSelection: ScannerParcelSelectionSummary;
  readonly topColocationProviders: readonly ScannerProviderSummary[];
  readonly topHyperscaleProviders: readonly ScannerProviderSummary[];
  readonly totalCount: number;
}

export interface ScannerInput {
  readonly colocationFeatures: FacilitiesFeatureCollection["features"];
  readonly hyperscaleFeatures: FacilitiesFeatureCollection["features"];
  readonly parcelFeatures: ParcelsFeatureCollection["features"];
  readonly parcelNextCursor: string | null;
  readonly parcelTruncated: boolean;
}

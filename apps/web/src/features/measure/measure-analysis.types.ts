import type { LngLat } from "@map-migration/map-engine";
import type { SpatialAnalysisFacilityRecord } from "@/features/spatial-analysis/spatial-analysis-facilities.types";
import type { SpatialAnalysisParcelRecord } from "@/features/spatial-analysis/spatial-analysis-parcels.types";
import type { SpatialAnalysisProviderSummaryItem } from "@/features/spatial-analysis/spatial-analysis-provider-summary.types";

export interface MeasureSelectedFacility extends SpatialAnalysisFacilityRecord {
  readonly countyFips: string;
  readonly providerId: string;
}

export interface MeasurePerspectiveSelectionSummary {
  readonly availablePowerMw: number;
  readonly commissionedPowerMw: number;
  readonly count: number;
  readonly leasedCount: number;
  readonly operationalCount: number;
  readonly pipelinePowerMw: number;
  readonly plannedCount: number;
  readonly plannedPowerMw: number;
  readonly squareFootage: number;
  readonly underConstructionCount: number;
  readonly underConstructionPowerMw: number;
  readonly unknownCount: number;
}

export interface MeasureProviderSummary extends SpatialAnalysisProviderSummaryItem {
  readonly providerId: string;
}

export interface MeasureSelectedParcel extends SpatialAnalysisParcelRecord {}

export interface MeasureParcelSelectionSummary {
  readonly count: number;
  readonly nextCursor: string | null;
  readonly parcels: readonly MeasureSelectedParcel[];
  readonly truncated: boolean;
}

export interface MeasureSelectionSummary {
  readonly colocation: MeasurePerspectiveSelectionSummary;
  readonly countyIds: readonly string[];
  readonly facilities: readonly MeasureSelectedFacility[];
  readonly hyperscale: MeasurePerspectiveSelectionSummary;
  readonly parcelSelection: MeasureParcelSelectionSummary;
  readonly ring: readonly LngLat[];
  readonly topColocationProviders: readonly MeasureProviderSummary[];
  readonly topHyperscaleProviders: readonly MeasureProviderSummary[];
  readonly totalCount: number;
}

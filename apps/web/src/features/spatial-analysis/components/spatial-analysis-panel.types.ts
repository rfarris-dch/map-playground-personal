import type { MarketSelectionMatch } from "@map-migration/contracts";
import type { SpatialAnalysisFacilityRecord } from "@/features/spatial-analysis/spatial-analysis-facilities.types";
import type { SpatialAnalysisParcelRecord } from "@/features/spatial-analysis/spatial-analysis-parcels.types";
import type { SpatialAnalysisProviderSummaryItem } from "@/features/spatial-analysis/spatial-analysis-provider-summary.types";

export interface SpatialAnalysisPanelPerspectiveSummary {
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

export interface SpatialAnalysisPanelSummary {
  readonly colocation: SpatialAnalysisPanelPerspectiveSummary;
  readonly facilities: readonly SpatialAnalysisFacilityRecord[];
  readonly hyperscale: SpatialAnalysisPanelPerspectiveSummary;
  readonly marketSelection?: {
    readonly markets: readonly MarketSelectionMatch[];
    readonly matchCount: number;
    readonly minimumSelectionOverlapPercent: number;
    readonly primaryMarket: MarketSelectionMatch | null;
    readonly selectionAreaSqKm: number;
    readonly unavailableReason: string | null;
  };
  readonly parcelSelection: {
    readonly count: number;
    readonly nextCursor: string | null;
    readonly parcels: readonly SpatialAnalysisParcelRecord[];
    readonly truncated: boolean;
  };
  readonly topColocationProviders: readonly SpatialAnalysisProviderSummaryItem[];
  readonly topHyperscaleProviders: readonly SpatialAnalysisProviderSummaryItem[];
  readonly totalCount: number;
}

export type SpatialAnalysisPanelTab = "facilities" | "overview" | "parcels";

export interface SpatialAnalysisPanelProps {
  readonly compactWidthClass?: string;
  readonly dashboardDisabled: boolean;
  readonly dashboardLabel: string;
  readonly dismissLabel: string;
  readonly emptyMessage: string;
  readonly errorMessage: string | null;
  readonly expandedWidthClass?: string;
  readonly exportDisabled: boolean;
  readonly exportLabel: string;
  readonly facilitiesPerspectiveDisplay?: "badge" | "dot";
  readonly facilitiesPowerHeading?: string;
  readonly formatFacilityPower: (powerMw: number | null) => string;
  readonly formatPower: (powerMw: number) => string;
  readonly isLoading: boolean;
  readonly isParcelsLoading?: boolean;
  readonly leaseSemantic?: boolean;
  readonly perspectivePowerLabel?: string;
  readonly showCoordinates?: boolean;
  readonly subtitle: string;
  readonly summary: SpatialAnalysisPanelSummary | null;
  readonly title: string;
}

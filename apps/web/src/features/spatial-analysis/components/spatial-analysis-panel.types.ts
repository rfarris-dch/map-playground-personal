import type { SpatialAnalysisSummaryResponse } from "@map-migration/http-contracts/spatial-analysis-summary-http";
import type { SelectionToolProgress } from "@/features/selection-tool/selection-tool.types";
import type { SpatialAnalysisFacilityRecord } from "@/features/spatial-analysis/spatial-analysis-facilities.types";
import type { SpatialAnalysisParcelRecord } from "@/features/spatial-analysis/spatial-analysis-parcels.types";
import type { SpatialAnalysisProviderSummaryItem } from "@/features/spatial-analysis/spatial-analysis-provider-summary.types";
import type { SpatialAnalysisSummaryModel } from "@/features/spatial-analysis/spatial-analysis-summary.types";

type SpatialAnalysisSelectionSummary = SpatialAnalysisSummaryResponse["summary"];

export type SpatialAnalysisPanelPerspectiveSummary = SpatialAnalysisSelectionSummary["colocation"];

export type SpatialAnalysisPanelMarketSelection = Omit<
  SpatialAnalysisSelectionSummary["marketSelection"],
  "markets"
> & {
  readonly markets: readonly SpatialAnalysisSelectionSummary["marketSelection"]["markets"][number][];
};

export type SpatialAnalysisPanelParcelSelection = Omit<
  SpatialAnalysisSelectionSummary["parcelSelection"],
  "parcels"
> & {
  readonly parcels: readonly SpatialAnalysisParcelRecord[];
};

export interface SpatialAnalysisPanelSummary {
  readonly colocation: SpatialAnalysisSelectionSummary["colocation"];
  readonly countyIds?: readonly SpatialAnalysisSelectionSummary["countyIds"][number][];
  readonly facilities: readonly SpatialAnalysisFacilityRecord[];
  readonly flood?: SpatialAnalysisSelectionSummary["flood"];
  readonly hyperscale: SpatialAnalysisSelectionSummary["hyperscale"];
  readonly marketSelection?: SpatialAnalysisPanelMarketSelection;
  readonly parcelSelection: SpatialAnalysisPanelParcelSelection;
  readonly topColocationProviders: readonly SpatialAnalysisProviderSummaryItem[];
  readonly topHyperscaleProviders: readonly SpatialAnalysisProviderSummaryItem[];
  readonly totalCount: SpatialAnalysisSelectionSummary["totalCount"];
}

export type SpatialAnalysisPanelTab = "counties" | "facilities" | "overview" | "parcels";

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
  readonly progress?: SelectionToolProgress | null;
  readonly showCoordinates?: boolean;
  readonly subtitle: string;
  readonly summary: SpatialAnalysisSummaryModel | null;
  readonly title: string;
}

import type { SpatialAnalysisPanelSummary } from "@/features/spatial-analysis/components/spatial-analysis-panel.types";
import type { SpatialAnalysisProviderSummaryItem } from "@/features/spatial-analysis/spatial-analysis-provider-summary.types";

export type SpatialAnalysisOverviewPerspectiveSummary = SpatialAnalysisPanelSummary["colocation"];

export type SpatialAnalysisOverviewProviderSummary = SpatialAnalysisProviderSummaryItem;

export type SpatialAnalysisOverviewSummary = Pick<
  SpatialAnalysisPanelSummary,
  | "colocation"
  | "flood"
  | "hyperscale"
  | "marketInsight"
  | "marketSelection"
  | "topColocationProviders"
  | "topHyperscaleProviders"
  | "totalCount"
>;

export interface SpatialAnalysisOverviewMetrics {
  readonly averageCommissionedPowerMwPerFacility: number;
  readonly averageSquareFootagePerFacility: number;
  readonly colocationAvailablePowerMw: number;
  readonly colocationCommissionedPowerMw: number;
  readonly colocationCount: number;
  readonly colocationPipelinePowerMw: number;
  readonly colocationPlannedPowerMw: number;
  readonly colocationUnderConstructionPowerMw: number;
  readonly hyperscaleCommissionedPowerMw: number;
  readonly hyperscaleCount: number;
  readonly hyperscaleOwnedPowerMw: number;
  readonly hyperscalePipelinePowerMw: number;
  readonly hyperscalePlannedPowerMw: number;
  readonly hyperscaleUnderConstructionPowerMw: number;
  readonly totalCommissionedPowerMw: number;
  readonly totalFacilities: number;
  readonly totalMarketSizeMw: number;
  readonly totalPipelinePowerMw: number;
  readonly totalSquareFootage: number;
}

export interface SpatialAnalysisOverviewParcelCandidate {
  readonly acres: number | null;
  readonly address: string | null;
  readonly county: string | null;
  readonly owner: string | null;
  readonly parcelNumber: string | null;
  readonly state: string | null;
}

export interface SpatialAnalysisOverviewParcelCandidateSummary {
  readonly averageAcres: number | null;
  readonly maxAcres: number | null;
  readonly sample: readonly SpatialAnalysisOverviewParcelCandidate[];
  readonly totalAcres: number | null;
}

export interface SpatialAnalysisOverviewStatusItem {
  readonly count: number;
  readonly label: string;
  readonly tone: "amber" | "cyan" | "emerald" | "rose" | "slate";
}

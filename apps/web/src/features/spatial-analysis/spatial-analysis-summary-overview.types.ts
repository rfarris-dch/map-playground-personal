import type { SpatialAnalysisSummaryResponse } from "@map-migration/http-contracts/spatial-analysis-summary-http";
import type { SpatialAnalysisProviderSummaryItem } from "@/features/spatial-analysis/spatial-analysis-provider-summary.types";

type SpatialAnalysisSelectionSummary = SpatialAnalysisSummaryResponse["summary"];

export type SpatialAnalysisOverviewPerspectiveSummary =
  SpatialAnalysisSelectionSummary["colocation"];

export type SpatialAnalysisOverviewProviderSummary = SpatialAnalysisProviderSummaryItem;

export interface SpatialAnalysisOverviewSummary {
  readonly colocation: SpatialAnalysisSelectionSummary["colocation"];
  readonly flood?: SpatialAnalysisSelectionSummary["flood"];
  readonly hyperscale: SpatialAnalysisSelectionSummary["hyperscale"];
  readonly topColocationProviders: readonly SpatialAnalysisOverviewProviderSummary[];
  readonly topHyperscaleProviders: readonly SpatialAnalysisOverviewProviderSummary[];
  readonly totalCount: SpatialAnalysisSelectionSummary["totalCount"];
}

export interface SpatialAnalysisOverviewMetrics {
  readonly averageCommissionedPowerMwPerFacility: number;
  readonly averageSquareFootagePerFacility: number;
  readonly colocationCommissionedPowerMw: number;
  readonly colocationCount: number;
  readonly colocationPipelinePowerMw: number;
  readonly hyperscaleCommissionedPowerMw: number;
  readonly hyperscaleCount: number;
  readonly hyperscalePipelinePowerMw: number;
  readonly totalCommissionedPowerMw: number;
  readonly totalFacilities: number;
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

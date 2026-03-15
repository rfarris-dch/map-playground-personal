import type { Warning } from "@map-migration/geo-kernel/warning";
import type {
  SpatialAnalysisArea,
  SpatialAnalysisCountyScores,
  SpatialAnalysisCountyScoresStatus,
  SpatialAnalysisPolicyEntry,
  SpatialAnalysisSummaryCoverage,
  SpatialAnalysisSummaryProvenance,
  SpatialAnalysisSummaryRequest,
  SpatialAnalysisSummaryResponse,
} from "@map-migration/http-contracts/spatial-analysis-summary-http";
import type { SpatialAnalysisPanelSummary } from "@/features/spatial-analysis/components/spatial-analysis-panel.types";

export type SpatialAnalysisCoverageModel = SpatialAnalysisSummaryCoverage;
export type SpatialAnalysisMetaModel = SpatialAnalysisSummaryResponse["meta"];
export type SpatialAnalysisPolicyEntryModel = SpatialAnalysisPolicyEntry;
export type SpatialAnalysisPolicyModel = SpatialAnalysisSummaryResponse["policy"];
export type SpatialAnalysisProvenanceModel = SpatialAnalysisSummaryProvenance;
export type SpatialAnalysisAreaModel = Omit<SpatialAnalysisArea, "countyIds"> & {
  readonly countyIds: readonly string[];
};
export type SpatialAnalysisRequestModel = Omit<SpatialAnalysisSummaryRequest, "perspectives"> & {
  readonly perspectives: readonly SpatialAnalysisSummaryRequest["perspectives"][number][];
};

export interface SpatialAnalysisCountyIntelligenceModel {
  readonly requestedCountyIds: readonly string[];
  readonly scores: SpatialAnalysisCountyScores | null;
  readonly scoresError: string | null;
  readonly status: SpatialAnalysisCountyScoresStatus | null;
  readonly statusError: string | null;
  readonly unavailableReason: string | null;
}

export interface SpatialAnalysisSummaryModel {
  readonly area: SpatialAnalysisAreaModel;
  readonly countyIntelligence: SpatialAnalysisCountyIntelligenceModel;
  readonly coverage: SpatialAnalysisCoverageModel | null;
  readonly meta: SpatialAnalysisMetaModel | null;
  readonly policy: SpatialAnalysisPolicyModel | null;
  readonly provenance: SpatialAnalysisProvenanceModel | null;
  readonly request: SpatialAnalysisRequestModel | null;
  readonly summary: SpatialAnalysisPanelSummary;
  readonly warnings: readonly Warning[];
}

import type {
  CountyScoresResponse,
  CountyScoresStatusResponse,
  SpatialAnalysisSummaryResponse,
  Warning,
} from "@map-migration/contracts";
import type { SpatialAnalysisPanelSummary } from "@/features/spatial-analysis/components/spatial-analysis-panel.types";

export interface SpatialAnalysisCountyIntelligenceModel {
  readonly requestedCountyIds: readonly string[];
  readonly scores: CountyScoresResponse | null;
  readonly scoresError: string | null;
  readonly status: CountyScoresStatusResponse | null;
  readonly statusError: string | null;
  readonly unavailableReason: string | null;
}

export interface SpatialAnalysisSummaryModel {
  readonly area: {
    readonly countyIds: readonly string[];
    readonly selectionAreaSqKm: number;
  };
  readonly countyIntelligence: SpatialAnalysisCountyIntelligenceModel;
  readonly coverage: SpatialAnalysisSummaryResponse["coverage"] | null;
  readonly meta: SpatialAnalysisSummaryResponse["meta"] | null;
  readonly policy: SpatialAnalysisSummaryResponse["policy"] | null;
  readonly provenance: SpatialAnalysisSummaryResponse["provenance"] | null;
  readonly request: SpatialAnalysisSummaryResponse["request"] | null;
  readonly summary: SpatialAnalysisPanelSummary;
  readonly warnings: readonly Warning[];
}

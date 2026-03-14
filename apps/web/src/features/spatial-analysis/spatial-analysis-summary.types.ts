import type { Warning } from "@map-migration/geo-kernel/warning";
import type { CountyScoresResponse, CountyScoresStatusResponse } from "@map-migration/http-contracts/county-intelligence-http";
import type { SpatialAnalysisPanelSummary } from "@/features/spatial-analysis/components/spatial-analysis-panel.types";

// ---------------------------------------------------------------------------
// Local model types — decoupled from API response shapes.
// The service layer maps API responses into these types.
// ---------------------------------------------------------------------------

export interface SpatialAnalysisCoverageModel {
  readonly countyIntelligence: {
    readonly availableFeatureFamilies: readonly string[];
    readonly datasetAvailable: boolean;
    readonly missingFeatureFamilies: readonly string[];
  };
  readonly flood: {
    readonly datasetAvailable: boolean;
    readonly included: boolean;
    readonly unavailableReason: string | null;
  };
  readonly markets: {
    readonly boundarySourceAvailable: boolean;
    readonly unavailableReason: string | null;
  };
  readonly parcels: {
    readonly included: boolean;
    readonly nextCursor: string | null;
    readonly truncated: boolean;
  };
}

export interface SpatialAnalysisMetaModel {
  readonly requestId: string;
  readonly sourceMode: string;
  readonly dataVersion: string;
  readonly generatedAt: string;
  readonly recordCount: number;
  readonly truncated: boolean;
  readonly warnings: readonly Warning[];
  readonly ingestionRunId?: string | undefined;
}

export interface SpatialAnalysisPolicyEntryModel {
  readonly dataset: string;
  readonly queryAllowed: boolean;
  readonly queryGranularity: string;
}

export interface SpatialAnalysisPolicyModel {
  readonly countyIntelligence: SpatialAnalysisPolicyEntryModel;
  readonly flood: SpatialAnalysisPolicyEntryModel;
  readonly facilities: SpatialAnalysisPolicyEntryModel;
  readonly parcels: SpatialAnalysisPolicyEntryModel;
}

export interface SpatialAnalysisProvenanceModel {
  readonly countyIntelligence: {
    readonly dataVersion: string | null;
    readonly formulaVersion: string | null;
    readonly inputDataVersion: string | null;
    readonly methodologyId: string | null;
    readonly publicationRunId: string | null;
    readonly publishedAt: string | null;
  };
  readonly flood: {
    readonly dataVersion: string | null;
    readonly runId: string | null;
    readonly sourceMode: string | null;
    readonly sourceVersion: string | null;
    readonly unavailableReason: string | null;
    readonly warnings: readonly Warning[];
  };
  readonly facilities: {
    readonly countsByPerspective: {
      readonly colocation: number;
      readonly hyperscale: number;
    };
    readonly dataVersion: string;
    readonly sourceMode: string;
    readonly truncatedByPerspective: {
      readonly colocation: boolean;
      readonly hyperscale: boolean;
    };
    readonly warnings: readonly Warning[];
  };
  readonly markets: {
    readonly dataVersion: string;
    readonly sourceMode: string;
    readonly sourceVersion: string | null;
    readonly unavailableReason: string | null;
    readonly warnings: readonly Warning[];
  };
  readonly parcels: {
    readonly dataVersion: string | null;
    readonly ingestionRunId: string | null;
    readonly nextCursor: string | null;
    readonly sourceMode: string | null;
    readonly warnings: readonly Warning[];
  };
}

export interface SpatialAnalysisRequestModel {
  readonly geometry: {
    readonly type: "Polygon";
    readonly coordinates: readonly (readonly (readonly [number, number])[])[];
  };
  readonly includeFlood: boolean;
  readonly includeParcels: boolean;
  readonly limitPerPerspective: number;
  readonly minimumMarketSelectionOverlapPercent: number;
  readonly parcelPageSize: number;
  readonly perspectives: readonly string[];
}

// ---------------------------------------------------------------------------

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
  readonly coverage: SpatialAnalysisCoverageModel | null;
  readonly meta: SpatialAnalysisMetaModel | null;
  readonly policy: SpatialAnalysisPolicyModel | null;
  readonly provenance: SpatialAnalysisProvenanceModel | null;
  readonly request: SpatialAnalysisRequestModel | null;
  readonly summary: SpatialAnalysisPanelSummary;
  readonly warnings: readonly Warning[];
}

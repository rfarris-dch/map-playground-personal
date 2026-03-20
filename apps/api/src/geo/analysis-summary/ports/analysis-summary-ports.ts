import type { FacilityPerspective } from "@map-migration/geo-kernel/facility-perspective";
import type { PolygonGeometry } from "@map-migration/geo-kernel/geometry";
import type { Warning } from "@map-migration/geo-kernel/warning";
import type { FacilitiesFeatureCollection } from "@map-migration/http-contracts/facilities-http";
import type { MarketSelectionMatch } from "@map-migration/http-contracts/markets-selection-http";
import type { ParcelsFeatureCollection } from "@map-migration/http-contracts/parcels-http";
import type {
  SpatialAnalysisMarketInsight,
  SpatialAnalysisSummaryRequest,
  SpatialAnalysisSummaryResponse,
} from "@map-migration/http-contracts/spatial-analysis-summary-http";
import type {
  QueryCountyScoresResult,
  QueryCountyScoresStatusResult,
} from "@/geo/county-intelligence/county-intelligence.service.types";
import type { QueryFloodAnalysisResult } from "@/geo/flood/flood.service.types";

export interface FacilitiesQueryResult {
  readonly ok: true;
  readonly value: {
    readonly features: FacilitiesFeatureCollection["features"];
    readonly truncated: boolean;
    readonly warnings: readonly Warning[];
  };
}

export interface FacilitiesQueryFailure {
  readonly ok: false;
  readonly value: {
    readonly error: unknown;
    readonly reason: "mapping_failed" | "query_failed";
  };
}

export type FacilitiesByPolygonResult = FacilitiesQueryResult | FacilitiesQueryFailure;

export interface FacilitiesGeometryResolution {
  readonly bbox: {
    readonly east: number;
    readonly north: number;
    readonly south: number;
    readonly west: number;
  };
  readonly geometryText: string;
}

export interface FacilitiesLimitResolution {
  readonly limit: number;
  readonly warning: Warning | null;
}

export interface ParcelsQueryOk {
  readonly ok: true;
  readonly value: {
    readonly dataVersion: string;
    readonly features: ParcelsFeatureCollection["features"];
    readonly ingestionRunId: string | null;
    readonly nextCursor: string | null;
    readonly sourceMode: SpatialAnalysisSummaryResponse["meta"]["sourceMode"];
    readonly truncated: boolean;
    readonly warnings: readonly Warning[];
  };
}

export interface ParcelsQueryFailure {
  readonly ok: false;
  readonly value: {
    readonly error: unknown;
    readonly reason:
      | "parcel_ingestion_run_mismatch"
      | "parcels_mapping_failed"
      | "parcels_policy_rejected"
      | "parcels_query_failed";
  };
}

export type ParcelsQueryResult = ParcelsQueryOk | ParcelsQueryFailure;

export interface MarketsQueryResult {
  readonly ok: true;
  readonly value: {
    readonly matchedMarkets: readonly MarketSelectionMatch[];
    readonly primaryMarket: MarketSelectionMatch | null;
    readonly selectionAreaSqKm: number;
    readonly truncated: boolean;
    readonly warnings: readonly Warning[];
  };
}

export interface MarketsQueryFailure {
  readonly ok: false;
  readonly value: {
    readonly error: unknown;
    readonly reason: "boundary_source_unavailable" | "mapping_failed" | "query_failed";
  };
}

export type MarketSelectionResult = MarketsQueryResult | MarketsQueryFailure;

export interface AnalysisSummaryRuntimeMetadata {
  readonly countyIntelligenceSourceMode: SpatialAnalysisSummaryResponse["meta"]["sourceMode"];
  readonly facilitiesDataVersion: string;
  readonly facilitiesSourceMode: SpatialAnalysisSummaryResponse["meta"]["sourceMode"];
  readonly floodSourceMode: SpatialAnalysisSummaryResponse["meta"]["sourceMode"];
  readonly marketsDataVersion: string;
  readonly marketsSourceMode: SpatialAnalysisSummaryResponse["meta"]["sourceMode"];
}

export interface SelectionGeometryNormalizationResult {
  readonly geometryText: string;
  readonly warning: Warning | null;
}

export type SelectionAreaAndCountyIdsResult =
  | {
      readonly ok: true;
      readonly value: {
        readonly countyIds: readonly string[];
        readonly selectionAreaSqKm: number;
      };
    }
  | {
      readonly ok: false;
      readonly value: {
        readonly error: unknown;
        readonly reason: "query_failed" | "source_unavailable";
      };
    };

export type MarketBoundarySourceVersionResult =
  | {
      readonly ok: true;
      readonly value: string | null;
    }
  | {
      readonly ok: false;
      readonly value: {
        readonly error: unknown;
        readonly reason: "query_failed" | "source_unavailable";
      };
    };

export interface SelectionPolicyPort {
  facilitiesBboxExceedsLimits(bbox: FacilitiesGeometryResolution["bbox"]): boolean;

  readonly facilitiesMaxPolygonJsonChars: number;
  isDatasetQueryAllowed(args: {
    readonly dataset: "county_scores" | "environmental_flood" | "facilities" | "parcels";
    readonly queryGranularity: "county" | "polygon";
  }): boolean;

  normalizeSelectionGeometry(geometryText: string): Promise<SelectionGeometryNormalizationResult>;

  resolveFacilitiesGeometry(
    geometry: SpatialAnalysisSummaryRequest["geometry"]
  ): FacilitiesGeometryResolution;

  resolveParcelPolicyWarning(args: {
    readonly includeParcels: boolean;
    readonly geometry: { type: "polygon"; geometry: PolygonGeometry };
  }): Warning | null;
}

export interface CountyIntelligencePort {
  lookupSelectionAreaAndCountyIds(
    geometryGeoJson: string
  ): Promise<SelectionAreaAndCountyIdsResult>;
  queryCountyScores(args: {
    readonly countyIds: readonly string[];
    readonly statusSnapshot?: unknown;
  }): Promise<QueryCountyScoresResult>;

  queryCountyScoresStatus(): Promise<QueryCountyScoresStatusResult>;
}

export interface FacilitiesSummaryPort {
  queryFacilitiesByPolygon(args: {
    readonly geometryGeoJson: string;
    readonly limit: number;
    readonly perspective: FacilityPerspective;
  }): Promise<FacilitiesByPolygonResult>;

  resolveFacilitiesLimit(args: {
    readonly perspective: FacilityPerspective;
    readonly requestedLimit: number;
  }): FacilitiesLimitResolution;
}

export interface FloodSummaryPort {
  queryFloodAnalysis(args: { readonly geometryGeoJson: string }): Promise<QueryFloodAnalysisResult>;
}

export interface MarketsSummaryPort {
  lookupMarketBoundarySourceVersion(): Promise<MarketBoundarySourceVersionResult>;
  queryMarketInsightByMarketId(args: { readonly marketId: string }): Promise<
    | {
        readonly ok: true;
        readonly value: SpatialAnalysisMarketInsight | null;
      }
    | {
        readonly ok: false;
        readonly value: {
          readonly error: unknown;
          readonly reason: "query_failed" | "source_unavailable";
        };
      }
  >;
  queryMarketsBySelection(args: {
    readonly geometryGeoJson: string;
    readonly limit: number;
    readonly minimumSelectionOverlapPercent: number;
  }): Promise<MarketSelectionResult>;
}

export interface ParcelsSummaryPort {
  queryParcels(args: {
    readonly expectedIngestionRunId: string | null;
    readonly geometryText: string;
    readonly includeGeometry: "centroid" | "full" | "none" | "simplified";
    readonly pageSize: number | undefined;
  }): Promise<ParcelsQueryResult>;
}

export interface AnalysisSummaryProvenancePort {
  getRuntimeMetadata(): AnalysisSummaryRuntimeMetadata;
}

export type AnalysisSummaryPorts = SelectionPolicyPort &
  CountyIntelligencePort &
  FacilitiesSummaryPort &
  FloodSummaryPort &
  MarketsSummaryPort &
  ParcelsSummaryPort &
  AnalysisSummaryProvenancePort;

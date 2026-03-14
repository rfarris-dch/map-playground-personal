import type { FacilityPerspective, Warning } from "@map-migration/geo-kernel";
import type {
  FacilitiesFeatureCollection,
  MarketSelectionMatch,
  ParcelsFeatureCollection,
  SpatialAnalysisSummaryRequest,
  SpatialAnalysisSummaryResponse,
} from "@map-migration/http-contracts";
import type {
  QueryCountyScoresResult,
  QueryCountyScoresStatusResult,
} from "@/geo/county-intelligence/county-intelligence.service.types";
import type { QueryFloodAnalysisResult } from "@/geo/flood/flood.service.types";

// ---------------------------------------------------------------------------
// Facilities
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Parcels
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Markets
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Port interface
// ---------------------------------------------------------------------------

export interface AnalysisSummaryPorts {
  /** Check whether the facilities bbox exceeds server-side extent limits. */
  facilitiesBboxExceedsLimits(bbox: FacilitiesGeometryResolution["bbox"]): boolean;

  /** Maximum allowed JSON character length for a facilities polygon payload. */
  readonly facilitiesMaxPolygonJsonChars: number;

  /** Query county scores for a set of county FIPS codes. */
  queryCountyScores(args: {
    readonly countyIds: readonly string[];
  }): Promise<QueryCountyScoresResult>;

  /** Query county scores dataset status. */
  queryCountyScoresStatus(): Promise<QueryCountyScoresStatusResult>;

  /** Query facilities by polygon for a single perspective. */
  queryFacilitiesByPolygon(args: {
    readonly geometryGeoJson: string;
    readonly limit: number;
    readonly perspective: FacilityPerspective;
  }): Promise<FacilitiesByPolygonResult>;

  /** Query flood analysis for a polygon geometry. */
  queryFloodAnalysis(args: { readonly geometryGeoJson: string }): Promise<QueryFloodAnalysisResult>;

  /** Query markets intersecting the selection polygon. */
  queryMarketsBySelection(args: {
    readonly geometryGeoJson: string;
    readonly limit: number;
    readonly minimumSelectionOverlapPercent: number;
  }): Promise<MarketSelectionResult>;

  /** Execute the full paginated parcel query (including mapping, ingestion-run checks, and pagination). */
  queryParcels(args: {
    readonly expectedIngestionRunId: string | null;
    readonly geometryText: string;
    readonly includeGeometry: "centroid" | "full" | "none" | "simplified";
    readonly pageSize: number | undefined;
  }): Promise<ParcelsQueryResult>;
  /** Resolve raw polygon geometry into bbox + GeoJSON text for facilities queries. */
  resolveFacilitiesGeometry(
    geometry: SpatialAnalysisSummaryRequest["geometry"]
  ): FacilitiesGeometryResolution;

  /** Resolve the per-perspective facilities limit (clamped to server max). */
  resolveFacilitiesLimit(args: {
    readonly perspective: FacilityPerspective;
    readonly requestedLimit: number;
  }): FacilitiesLimitResolution;

  /** Check parcel policy: returns a rejection warning, or null if policy passes. */
  resolveParcelPolicyWarning(args: {
    readonly includeParcels: boolean;
    readonly geometry: { type: "polygon"; geometry: unknown };
  }): Warning | null;
}

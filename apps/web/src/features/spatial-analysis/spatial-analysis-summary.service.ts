import type {
  CountyScoresResponse,
  CountyScoresStatusResponse,
  SpatialAnalysisSummaryResponse,
  Warning,
} from "@map-migration/contracts";
import { buildMeasureSelectionSummary } from "@/features/measure/measure-analysis.service";
import type { ScannerSummary } from "@/features/scanner/scanner.types";
import type { SpatialAnalysisSummaryModel } from "@/features/spatial-analysis/spatial-analysis-summary.types";

function emptyWarnings(): readonly Warning[] {
  return [];
}

function emptyMarketSelectionSummary() {
  return {
    markets: [],
    matchCount: 0,
    minimumSelectionOverlapPercent: 0,
    primaryMarket: null,
    selectionAreaSqKm: 0,
    unavailableReason: null,
  };
}

export function buildEmptySpatialAnalysisSummary(
  selectionRing: readonly [number, number][]
): SpatialAnalysisSummaryModel {
  return {
    area: {
      countyIds: [],
      selectionAreaSqKm: 0,
    },
    countyIntelligence: {
      requestedCountyIds: [],
      scores: null,
      scoresError: null,
      status: null,
      statusError: null,
      unavailableReason: null,
    },
    coverage: null,
    meta: null,
    policy: null,
    provenance: null,
    request: null,
    summary: {
      ...buildMeasureSelectionSummary({
        ring: selectionRing,
        colocationFeatures: [],
        hyperscaleFeatures: [],
        parcelFeatures: [],
        parcelTruncated: false,
        parcelNextCursor: null,
      }),
      marketSelection: emptyMarketSelectionSummary(),
    },
    warnings: emptyWarnings(),
  };
}

export function buildSpatialAnalysisSummaryModel(
  response: SpatialAnalysisSummaryResponse
): SpatialAnalysisSummaryModel {
  return {
    area: response.area,
    countyIntelligence: {
      requestedCountyIds: response.countyIntelligence.requestedCountyIds,
      scores: response.countyIntelligence.scores,
      scoresError: null,
      status: response.countyIntelligence.status,
      statusError: null,
      unavailableReason: response.countyIntelligence.unavailableReason,
    },
    coverage: response.coverage,
    meta: response.meta,
    policy: response.policy,
    provenance: response.provenance,
    request: response.request,
    summary: response.summary,
    warnings: response.warnings,
  };
}

export function buildScannerSpatialAnalysisSummary(args: {
  readonly countyIds: readonly string[];
  readonly countyScores: CountyScoresResponse | null;
  readonly countyScoresError: string | null;
  readonly countyScoresStatus: CountyScoresStatusResponse | null;
  readonly countyScoresStatusError: string | null;
  readonly marketSelection: NonNullable<SpatialAnalysisSummaryModel["summary"]["marketSelection"]>;
  readonly summary: ScannerSummary;
}): SpatialAnalysisSummaryModel {
  const countyWarnings: Warning[] = [];
  if (args.countyScoresError !== null) {
    countyWarnings.push({
      code: "COUNTY_INTELLIGENCE_FAILED",
      message: args.countyScoresError,
    });
  }

  if (args.countyScoresStatusError !== null) {
    countyWarnings.push({
      code: "COUNTY_INTELLIGENCE_STATUS_FAILED",
      message: args.countyScoresStatusError,
    });
  }

  return {
    area: {
      countyIds: args.countyIds,
      selectionAreaSqKm: 0,
    },
    countyIntelligence: {
      requestedCountyIds: args.countyIds,
      scores: args.countyScores,
      scoresError: args.countyScoresError,
      status: args.countyScoresStatus,
      statusError: args.countyScoresStatusError,
      unavailableReason: null,
    },
    coverage: null,
    meta: null,
    policy: null,
    provenance: null,
    request: null,
    summary: {
      ...args.summary,
      marketSelection: args.marketSelection,
    },
    warnings: countyWarnings,
  };
}

import type { Warning } from "@map-migration/geo-kernel/warning";
import type {
  CountyScoresResponse,
  CountyScoresStatusResponse,
} from "@map-migration/http-contracts/county-intelligence-http";
import type {
  SpatialAnalysisCountyScores,
  SpatialAnalysisCountyScoresStatus,
  SpatialAnalysisSummaryResponse,
} from "@map-migration/http-contracts/spatial-analysis-summary-http";
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

function emptyFloodSummary() {
  return {
    flood100AreaSqKm: 0,
    flood100SelectionShare: 0,
    flood500AreaSqKm: 0,
    flood500SelectionShare: 0,
    parcelCountIntersectingFlood100: 0,
    parcelCountIntersectingFlood500: 0,
    parcelCountOutsideMappedFlood: 0,
    selectionAreaSqKm: 0,
    unavailableReason: null,
  };
}

function toSpatialAnalysisCountyScores(
  value: CountyScoresResponse | null
): SpatialAnalysisCountyScores | null {
  if (value === null) {
    return null;
  }

  return {
    rows: value.rows,
    summary: value.summary,
  };
}

function toSpatialAnalysisCountyScoresStatus(
  value: CountyScoresStatusResponse | null
): SpatialAnalysisCountyScoresStatus | null {
  if (value === null) {
    return null;
  }

  return {
    availableFeatureFamilies: value.availableFeatureFamilies,
    blockedCountyCount: value.blockedCountyCount,
    dataVersion: value.dataVersion,
    datasetAvailable: value.datasetAvailable,
    deferredCountyCount: value.deferredCountyCount,
    featureCoverage: value.featureCoverage,
    formulaVersion: value.formulaVersion,
    freshCountyCount: value.freshCountyCount,
    freshnessStateCounts: value.freshnessStateCounts,
    highConfidenceCount: value.highConfidenceCount,
    inputDataVersion: value.inputDataVersion,
    lowConfidenceCount: value.lowConfidenceCount,
    mediumConfidenceCount: value.mediumConfidenceCount,
    methodologyId: value.methodologyId,
    missingFeatureFamilies: value.missingFeatureFamilies,
    publicationRunId: value.publicationRunId,
    publishedAt: value.publishedAt,
    rankedCountyCount: value.rankedCountyCount,
    registryVersion: value.registryVersion,
    rowCount: value.rowCount,
    sourceCountyCount: value.sourceCountyCount,
    suppressionStateCounts: value.suppressionStateCounts,
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
    history: null,
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
      flood: emptyFloodSummary(),
      marketInsight: null,
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
    history: null,
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
      scores: toSpatialAnalysisCountyScores(args.countyScores),
      scoresError: args.countyScoresError,
      status: toSpatialAnalysisCountyScoresStatus(args.countyScoresStatus),
      statusError: args.countyScoresStatusError,
      unavailableReason: null,
    },
    coverage: null,
    history: null,
    meta: null,
    policy: null,
    provenance: null,
    request: null,
    summary: {
      ...args.summary,
      flood: emptyFloodSummary(),
      marketInsight: null,
      marketSelection: args.marketSelection,
    },
    warnings: countyWarnings,
  };
}

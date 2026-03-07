import type {
  FacilitiesFeatureCollection,
  FacilitiesSelectionRequest,
  FacilityPerspective,
  ParcelEnrichRequest,
  ParcelsFeatureCollection,
} from "@map-migration/contracts";
import { exportMeasureSelectionSummary } from "@/features/app/measure-selection/measure-selection-export.service";
import { fetchFacilitiesBySelection } from "@/features/measure/measure-analysis.api";
import { buildMeasureSelectionSummary } from "@/features/measure/measure-analysis.service";
import {
  formatSelectionApiFailure,
  selectionAoiFromRing,
  selectionGeometryFromRing,
} from "@/features/selection/selection-analysis-request.service";
import { fetchMarketsBySelection } from "@/features/selection-tool/selection-tool.api";
import type {
  MarketsSelectionRequestInput,
  MarketsSelectionResult,
  QuerySelectionToolSummaryArgs,
  QuerySelectionToolSummaryResult,
  SelectionToolMarketSummary,
  SelectionToolSummary,
} from "@/features/selection-tool/selection-tool.types";
import { fetchSpatialAnalysisParcelsPages } from "@/features/spatial-analysis/spatial-analysis-parcels-query.service";

const SELECTION_TOOL_MARKETS_LIMIT = 25;
const SELECTION_TOOL_PARCELS_PAGE_SIZE = 20_000;
const MARKET_BOUNDARY_SOURCE_UNAVAILABLE_CODE = "MARKET_BOUNDARY_SOURCE_UNAVAILABLE";

function facilitiesForPerspective(
  features: FacilitiesFeatureCollection["features"],
  perspective: FacilityPerspective
): FacilitiesFeatureCollection["features"] {
  return features.filter((feature) => feature.properties.perspective === perspective);
}

function buildEmptyMarketSelectionSummary(
  minimumSelectionOverlapPercent = 0
): SelectionToolMarketSummary {
  return {
    markets: [],
    matchCount: 0,
    minimumSelectionOverlapPercent,
    primaryMarket: null,
    selectionAreaSqKm: 0,
    unavailableReason: null,
  };
}

function isMarketBoundarySourceUnavailable(result: MarketsSelectionResult): boolean {
  return !result.ok && result.code === MARKET_BOUNDARY_SOURCE_UNAVAILABLE_CODE;
}

function listVisiblePerspectives(
  visiblePerspectives: QuerySelectionToolSummaryArgs["visiblePerspectives"]
): FacilityPerspective[] {
  const perspectives: FacilityPerspective[] = [];
  if (visiblePerspectives.colocation) {
    perspectives.push("colocation");
  }
  if (visiblePerspectives.hyperscale) {
    perspectives.push("hyperscale");
  }
  return perspectives;
}

export function buildEmptySelectionToolSummary(
  selectionRing: readonly [number, number][],
  minimumSelectionOverlapPercent = 0
): SelectionToolSummary {
  return {
    ...buildMeasureSelectionSummary({
      ring: selectionRing,
      colocationFeatures: [],
      hyperscaleFeatures: [],
      parcelFeatures: [],
      parcelTruncated: false,
      parcelNextCursor: null,
    }),
    marketSelection: buildEmptyMarketSelectionSummary(minimumSelectionOverlapPercent),
  };
}

export async function querySelectionToolSummary(
  args: QuerySelectionToolSummaryArgs
): Promise<QuerySelectionToolSummaryResult> {
  const minimumSelectionOverlapPercent = args.minimumMarketSelectionOverlapPercent ?? 0;
  const perspectives = listVisiblePerspectives(args.visiblePerspectives);

  const facilitiesRequest =
    perspectives.length > 0
      ? ({
          geometry: selectionGeometryFromRing(args.selectionRing),
          perspectives,
          limitPerPerspective: 5000,
        } satisfies FacilitiesSelectionRequest)
      : null;

  const marketsRequest: MarketsSelectionRequestInput = {
    geometry: selectionGeometryFromRing(args.selectionRing),
    limit: SELECTION_TOOL_MARKETS_LIMIT,
    minimumSelectionOverlapPercent,
  };

  const parcelsRequest: ParcelEnrichRequest = {
    aoi: selectionAoiFromRing(args.selectionRing),
    profile: "analysis_v1",
    includeGeometry: "centroid",
    pageSize: SELECTION_TOOL_PARCELS_PAGE_SIZE,
    format: "json",
  };

  const [facilitiesResult, marketsResult, parcelsResult] = await Promise.all([
    facilitiesRequest === null
      ? Promise.resolve<Awaited<ReturnType<typeof fetchFacilitiesBySelection>> | null>(null)
      : fetchFacilitiesBySelection(facilitiesRequest, args.signal),
    fetchMarketsBySelection(marketsRequest, args.signal),
    args.includeParcels === true
      ? fetchSpatialAnalysisParcelsPages({
          expectedIngestionRunId: args.expectedParcelsIngestionRunId,
          request: parcelsRequest,
          signal: args.signal,
          cursorRepeatLogContext: "selection-tool",
        })
      : Promise.resolve<
          | {
              readonly ok: true;
              readonly features: ParcelsFeatureCollection["features"];
              readonly nextCursor: string | null;
              readonly truncated: boolean;
            }
          | { readonly ok: false; readonly reason: "aborted" | "skipped" }
        >({
          ok: true,
          features: [],
          nextCursor: null,
          truncated: false,
        }),
  ]);

  if (
    (facilitiesResult !== null && !facilitiesResult.ok && facilitiesResult.reason === "aborted") ||
    (!marketsResult.ok && marketsResult.reason === "aborted") ||
    (!parcelsResult.ok && parcelsResult.reason === "aborted")
  ) {
    return {
      ok: false,
      reason: "aborted",
    };
  }

  const errorMessages: string[] = [];

  let colocationFeatures: FacilitiesFeatureCollection["features"] = [];
  let hyperscaleFeatures: FacilitiesFeatureCollection["features"] = [];
  if (facilitiesResult !== null) {
    if (facilitiesResult.ok) {
      colocationFeatures = facilitiesForPerspective(facilitiesResult.data.features, "colocation");
      hyperscaleFeatures = facilitiesForPerspective(facilitiesResult.data.features, "hyperscale");
    } else {
      errorMessages.push(formatSelectionApiFailure("Facilities", facilitiesResult));
    }
  }

  let marketSelection = buildEmptyMarketSelectionSummary(minimumSelectionOverlapPercent);
  if (marketsResult.ok) {
    marketSelection = {
      markets: marketsResult.data.matchedMarkets,
      matchCount: marketsResult.data.selection.matchCount,
      minimumSelectionOverlapPercent: marketsResult.data.selection.minimumSelectionOverlapPercent,
      primaryMarket: marketsResult.data.primaryMarket,
      selectionAreaSqKm: marketsResult.data.selection.selectionAreaSqKm,
      unavailableReason: null,
    };
  } else if (isMarketBoundarySourceUnavailable(marketsResult)) {
    marketSelection = {
      ...marketSelection,
      unavailableReason: marketsResult.message ?? "Market boundary dataset is unavailable.",
    };
  } else {
    errorMessages.push(formatSelectionApiFailure("Markets", marketsResult));
  }

  let parcelFeatures: ParcelsFeatureCollection["features"] = [];
  let parcelTruncated = false;
  let parcelNextCursor: string | null = null;
  if (parcelsResult.ok) {
    parcelFeatures = parcelsResult.features;
    parcelTruncated = parcelsResult.truncated;
    parcelNextCursor = parcelsResult.nextCursor;
  } else if (parcelsResult.reason !== "skipped") {
    errorMessages.push(formatSelectionApiFailure("Parcels", parcelsResult));
  }

  return {
    ok: true,
    value: {
      errorMessage: errorMessages.length > 0 ? errorMessages.join(" ") : null,
      summary: {
        ...buildMeasureSelectionSummary({
          ring: args.selectionRing,
          colocationFeatures,
          hyperscaleFeatures,
          parcelFeatures,
          parcelTruncated,
          parcelNextCursor,
        }),
        marketSelection,
      },
    },
  };
}

export function exportSelectionToolSummary(summary: SelectionToolSummary | null): void {
  exportMeasureSelectionSummary(summary);
}

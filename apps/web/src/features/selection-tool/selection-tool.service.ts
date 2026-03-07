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
  SelectionToolProgress,
  SelectionToolProgressStage,
  SelectionToolProgressStageKey,
  SelectionToolSummary,
} from "@/features/selection-tool/selection-tool.types";
import { fetchSpatialAnalysisParcelsPages } from "@/features/spatial-analysis/spatial-analysis-parcels-query.service";

const SELECTION_TOOL_MARKETS_LIMIT = 25;
const SELECTION_TOOL_PARCELS_PAGE_SIZE = 20_000;
const MARKET_BOUNDARY_SOURCE_UNAVAILABLE_CODE = "MARKET_BOUNDARY_SOURCE_UNAVAILABLE";
type FacilitiesSelectionResult = NonNullable<
  Awaited<ReturnType<typeof fetchFacilitiesBySelection>>
>;
type ParcelsPagesResult = Awaited<ReturnType<typeof fetchSpatialAnalysisParcelsPages>>;

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

function createProgressStage(
  key: SelectionToolProgressStageKey,
  status: SelectionToolProgressStage["status"],
  detail: string | null,
  completedWork = 0,
  totalWork: number | null = 1
): SelectionToolProgressStage {
  const labels: Record<SelectionToolProgressStageKey, string> = {
    facilities: "Facilities",
    markets: "Markets",
    parcels: "Parcels",
  };

  return {
    completedWork,
    detail,
    key,
    label: labels[key],
    status,
    totalWork,
  };
}

function createInitialSelectionProgress(
  facilitiesRequestCount: number,
  includeParcels: boolean
): SelectionToolProgress {
  const stages: readonly SelectionToolProgressStage[] = [
    facilitiesRequestCount > 0
      ? createProgressStage(
          "facilities",
          "running",
          `Querying ${facilitiesRequestCount} facility ${facilitiesRequestCount === 1 ? "layer" : "layers"}…`,
          0,
          facilitiesRequestCount
        )
      : createProgressStage("facilities", "skipped", "No facility layers enabled.", 1),
    createProgressStage("markets", "running", "Querying market coverage…"),
    includeParcels
      ? createProgressStage("parcels", "running", "Loading parcel pages…", 0, null)
      : createProgressStage("parcels", "skipped", "Parcel enrichment disabled.", 1),
  ];

  return buildSelectionProgress(stages);
}

function buildSelectionProgress(
  stages: readonly SelectionToolProgressStage[]
): SelectionToolProgress {
  const relevantStages = stages.filter((stage) => stage.status !== "skipped");
  const completedStageCount = relevantStages.filter(
    (stage) => stage.status === "complete" || stage.status === "error"
  ).length;
  const activeStage =
    relevantStages.find((stage) => stage.status === "running") ??
    relevantStages.find((stage) => stage.status === "pending") ??
    null;

  return {
    activeStageKey: activeStage?.key ?? null,
    completedStageCount,
    percent:
      relevantStages.length === 0
        ? 100
        : Math.round((completedStageCount / relevantStages.length) * 100),
    stages,
    totalStageCount: relevantStages.length,
  };
}

function updateSelectionProgressStage(
  progress: SelectionToolProgress,
  key: SelectionToolProgressStageKey,
  updates: Partial<Omit<SelectionToolProgressStage, "key" | "label">>
): SelectionToolProgress {
  const stages = progress.stages.map((stage) => {
    if (stage.key !== key) {
      return stage;
    }

    return {
      ...stage,
      ...updates,
    };
  });

  return buildSelectionProgress(stages);
}

function publishSelectionProgress(
  args: QuerySelectionToolSummaryArgs,
  progress: SelectionToolProgress
): SelectionToolProgress {
  args.onProgress?.(progress);
  return progress;
}

function formatFacilityPerspectiveLabel(perspective: FacilityPerspective): string {
  return perspective === "colocation" ? "Colocation" : "Hyperscale";
}

function formatFacilitiesPerspectiveDetail(args: {
  readonly completedRequestCount: number;
  readonly perspective: FacilityPerspective;
  readonly result: FacilitiesSelectionResult;
  readonly totalRequestCount: number;
}): string {
  const perspectiveLabel = formatFacilityPerspectiveLabel(args.perspective);
  const progressLabel = `${args.completedRequestCount} of ${args.totalRequestCount} facility scans finished`;
  if (args.result.ok) {
    return `${perspectiveLabel} loaded · ${args.result.data.features.length} facilities · ${progressLabel}`;
  }

  if (args.result.reason === "aborted") {
    return `${perspectiveLabel} canceled · ${progressLabel}`;
  }

  return `${perspectiveLabel} failed · ${progressLabel}`;
}

function marketsProgressUpdate(result: MarketsSelectionResult): {
  readonly detail: string;
  readonly status: SelectionToolProgressStage["status"];
} {
  if (result.ok) {
    return {
      detail: `${result.data.selection.matchCount} markets matched.`,
      status: "complete",
    };
  }

  if (result.reason === "aborted") {
    return {
      detail: "Markets request canceled.",
      status: "complete",
    };
  }

  if (result.code === MARKET_BOUNDARY_SOURCE_UNAVAILABLE_CODE) {
    return {
      detail: "Market boundaries are unavailable.",
      status: "complete",
    };
  }

  return {
    detail: "Markets query failed.",
    status: "error",
  };
}

function formatParcelPageDetail(pageCount: number, parcelCount: number): string {
  return `Loaded ${pageCount} parcel page${pageCount === 1 ? "" : "s"} · ${parcelCount} parcels`;
}

function currentStageCompletedWork(
  progress: SelectionToolProgress,
  key: SelectionToolProgressStageKey
): number {
  return progress.stages.find((stage) => stage.key === key)?.completedWork ?? 0;
}

function parcelsProgressUpdate(
  result: ParcelsPagesResult,
  progress: SelectionToolProgress
): {
  readonly completedWork: number;
  readonly detail: string;
  readonly status: SelectionToolProgressStage["status"];
  readonly totalWork: number | null;
} {
  if (result.ok) {
    return {
      completedWork: result.features.length,
      detail: `${result.features.length} parcels loaded.`,
      status: "complete",
      totalWork: result.features.length,
    };
  }

  if (result.reason === "aborted") {
    return {
      completedWork: currentStageCompletedWork(progress, "parcels"),
      detail: "Parcels request canceled.",
      status: "complete",
      totalWork: null,
    };
  }

  return {
    completedWork: currentStageCompletedWork(progress, "parcels"),
    detail: "Parcels query failed.",
    status: "error",
    totalWork: null,
  };
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
  const includeParcels = args.includeParcels === true;
  const selectionGeometry = selectionGeometryFromRing(args.selectionRing);

  const facilitiesRequests = perspectives.map((perspective) => ({
    perspective,
    request: {
      geometry: selectionGeometry,
      perspectives: [perspective],
      limitPerPerspective: 5000,
    } satisfies FacilitiesSelectionRequest,
  }));

  const marketsRequest: MarketsSelectionRequestInput = {
    geometry: selectionGeometry,
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

  let progress = publishSelectionProgress(
    args,
    createInitialSelectionProgress(facilitiesRequests.length, includeParcels)
  );

  let completedFacilitiesRequestCount = 0;
  let facilitiesStageFailed = false;
  const [facilitiesResults, marketsResult, parcelsResult] = await Promise.all([
    facilitiesRequests.length === 0
      ? Promise.resolve<
          readonly {
            readonly perspective: FacilityPerspective;
            readonly result: FacilitiesSelectionResult;
          }[]
        >([])
      : Promise.all(
          facilitiesRequests.map(({ perspective, request }) =>
            fetchFacilitiesBySelection(request, args.signal).then((result) => {
              completedFacilitiesRequestCount += 1;
              if (!result.ok && result.reason !== "aborted") {
                facilitiesStageFailed = true;
              }
              let facilitiesStageStatus: SelectionToolProgressStage["status"] = "running";
              if (completedFacilitiesRequestCount === facilitiesRequests.length) {
                facilitiesStageStatus = facilitiesStageFailed ? "error" : "complete";
              }

              progress = publishSelectionProgress(
                args,
                updateSelectionProgressStage(progress, "facilities", {
                  completedWork: completedFacilitiesRequestCount,
                  detail: formatFacilitiesPerspectiveDetail({
                    completedRequestCount: completedFacilitiesRequestCount,
                    perspective,
                    result,
                    totalRequestCount: facilitiesRequests.length,
                  }),
                  status: facilitiesStageStatus,
                  totalWork: facilitiesRequests.length,
                })
              );

              return {
                perspective,
                result,
              };
            })
          )
        ),
    fetchMarketsBySelection(marketsRequest, args.signal).then((result) => {
      const marketsStage = marketsProgressUpdate(result);
      progress = publishSelectionProgress(
        args,
        updateSelectionProgressStage(progress, "markets", {
          completedWork: 1,
          detail: marketsStage.detail,
          status: marketsStage.status,
          totalWork: 1,
        })
      );

      return result;
    }),
    includeParcels
      ? fetchSpatialAnalysisParcelsPages({
          expectedIngestionRunId: args.expectedParcelsIngestionRunId,
          onPage(pageArgs) {
            progress = publishSelectionProgress(
              args,
              updateSelectionProgressStage(progress, "parcels", {
                completedWork: pageArgs.pageCount,
                detail: formatParcelPageDetail(pageArgs.pageCount, pageArgs.parcelCount),
                status: "running",
                totalWork: null,
              })
            );
          },
          request: parcelsRequest,
          signal: args.signal,
          cursorRepeatLogContext: "selection-tool",
        }).then((result) => {
          const parcelsStage = parcelsProgressUpdate(result, progress);
          progress = publishSelectionProgress(
            args,
            updateSelectionProgressStage(progress, "parcels", {
              completedWork: parcelsStage.completedWork,
              detail: parcelsStage.detail,
              status: parcelsStage.status,
              totalWork: parcelsStage.totalWork,
            })
          );

          return result;
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
        }).then((result) => {
          progress = publishSelectionProgress(
            args,
            updateSelectionProgressStage(progress, "parcels", {
              completedWork: 1,
              detail: "Parcel enrichment disabled.",
              status: "skipped",
              totalWork: 1,
            })
          );

          return result;
        }),
  ]);

  if (
    facilitiesResults.some((item) => !item.result.ok && item.result.reason === "aborted") ||
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
  for (const { perspective, result } of facilitiesResults) {
    if (result.ok) {
      if (perspective === "colocation") {
        colocationFeatures = result.data.features;
        continue;
      }

      hyperscaleFeatures = result.data.features;
      continue;
    }

    errorMessages.push(
      formatSelectionApiFailure(`${formatFacilityPerspectiveLabel(perspective)} Facilities`, result)
    );
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

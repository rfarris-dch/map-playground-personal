import type {
  FacilitiesFeatureCollection,
  MarketSelectionMatch,
  MarketsSelectionRequest,
  SpatialAnalysisSummaryRequest,
  SpatialAnalysisSummaryResponse,
} from "@map-migration/contracts";
import {
  ApiAbortedError,
  type ApiEffectError,
  type ApiEffectSuccess,
  getApiErrorMessage,
} from "@map-migration/core-runtime/api";
import { Effect, Either } from "effect";
import { exportMeasureSelectionSummary } from "@/features/app/measure-selection/measure-selection-export.service";
import { fetchFacilitiesByBboxEffect } from "@/features/facilities/api";
import type { FacilitiesBboxRequest } from "@/features/facilities/facilities.types";
import { buildMeasureSelectionSummary } from "@/features/measure/measure-analysis.service";
import type { MeasureSelectionSummary } from "@/features/measure/measure-analysis.types";
import {
  buildSelectionRingBbox,
  selectionGeometryFromRing,
  selectionRingExceedsFastAnalysisLimits,
} from "@/features/selection/selection-analysis-request.service";
import { fetchMarketsBySelectionEffect } from "@/features/selection-tool/selection-tool.api";
import type {
  QuerySelectionToolSummaryArgs,
  QuerySelectionToolSummaryResult,
  SelectionToolAnalysisSummary,
  SelectionToolProgress,
  SelectionToolProgressStageKey,
} from "@/features/selection-tool/selection-tool.types";
import { fetchSpatialAnalysisSummaryEffect } from "@/features/spatial-analysis/spatial-analysis-summary.api";
import {
  buildEmptySpatialAnalysisSummary,
  buildSpatialAnalysisSummaryModel,
} from "@/features/spatial-analysis/spatial-analysis-summary.service";

function listVisiblePerspectives(
  visiblePerspectives: QuerySelectionToolSummaryArgs["visiblePerspectives"]
): SpatialAnalysisSummaryRequest["perspectives"] {
  const perspectives: SpatialAnalysisSummaryRequest["perspectives"] = [];
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
  status: SelectionToolProgress["stages"][number]["status"],
  detail: string | null,
  completedWork = 0,
  totalWork: number | null = 1
): SelectionToolProgress["stages"][number] {
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

function buildSelectionProgress(
  stages: readonly SelectionToolProgress["stages"][number][]
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

function createInitialSelectionProgress(
  perspectiveCount: number,
  includeParcels: boolean
): SelectionToolProgress {
  return buildSelectionProgress([
    perspectiveCount > 0
      ? createProgressStage("facilities", "running", "Analyzing facilities…")
      : createProgressStage("facilities", "skipped", "No facility layers enabled.", 1),
    createProgressStage("markets", "running", "Querying market coverage…"),
    includeParcels
      ? createProgressStage("parcels", "running", "Loading parcels…")
      : createProgressStage("parcels", "skipped", "Parcel enrichment disabled.", 1),
  ]);
}

function publishSelectionProgress(
  args: QuerySelectionToolSummaryArgs,
  progress: SelectionToolProgress
): SelectionToolProgress {
  args.onProgress?.(progress);
  return progress;
}

function completedSelectionProgress(args: {
  readonly includeParcels: boolean;
  readonly perspectiveCount: number;
  readonly marketCount: number;
  readonly parcelCount: number;
  readonly totalFacilityCount: number;
}): SelectionToolProgress {
  return buildSelectionProgress([
    args.perspectiveCount > 0
      ? createProgressStage(
          "facilities",
          "complete",
          `${args.totalFacilityCount} facilities loaded.`,
          args.perspectiveCount,
          args.perspectiveCount
        )
      : createProgressStage("facilities", "skipped", "No facility layers enabled.", 1),
    createProgressStage("markets", "complete", `${args.marketCount} markets matched.`, 1),
    args.includeParcels
      ? createProgressStage("parcels", "complete", `${args.parcelCount} parcels loaded.`, 1)
      : createProgressStage("parcels", "skipped", "Parcel enrichment disabled.", 1),
  ]);
}

function toMeasureSelectionSummary(summary: SelectionToolAnalysisSummary): MeasureSelectionSummary {
  const ring = summary.request?.geometry.coordinates[0] ?? [];

  return {
    colocation: summary.summary.colocation,
    countyIds: summary.area.countyIds,
    facilities: summary.summary.facilities,
    hyperscale: summary.summary.hyperscale,
    parcelSelection: summary.summary.parcelSelection,
    ring: ring.map((vertex) => [vertex[0], vertex[1]]),
    topColocationProviders: summary.summary.topColocationProviders.map((provider) => ({
      commissionedPowerMw: provider.commissionedPowerMw,
      count: provider.count,
      providerId: provider.providerId ?? provider.providerName,
      providerName: provider.providerName,
    })),
    topHyperscaleProviders: summary.summary.topHyperscaleProviders.map((provider) => ({
      commissionedPowerMw: provider.commissionedPowerMw,
      count: provider.count,
      providerId: provider.providerId ?? provider.providerName,
      providerName: provider.providerName,
    })),
    totalCount: summary.summary.totalCount,
  };
}

function readSelectionWarningMessage(response: SpatialAnalysisSummaryResponse): string | null {
  const parcelWarning =
    response.warnings.find((warning) => warning.code === "PARCELS_POLICY_REJECTED") ?? null;
  return parcelWarning?.message ?? null;
}

function partitionSelectionFacilities(features: FacilitiesFeatureCollection["features"]): {
  readonly colocationFeatures: FacilitiesFeatureCollection["features"];
  readonly hyperscaleFeatures: FacilitiesFeatureCollection["features"];
} {
  const colocationFeatures: FacilitiesFeatureCollection["features"] = [];
  const hyperscaleFeatures: FacilitiesFeatureCollection["features"] = [];

  for (const feature of features) {
    if (feature.properties.perspective === "colocation") {
      colocationFeatures.push(feature);
      continue;
    }

    if (feature.properties.perspective === "hyperscale") {
      hyperscaleFeatures.push(feature);
    }
  }

  return {
    colocationFeatures,
    hyperscaleFeatures,
  };
}

function buildLargeSelectionFallbackSummary(args: {
  readonly facilitiesFeatures: FacilitiesFeatureCollection["features"];
  readonly marketSelection: {
    readonly markets: readonly MarketSelectionMatch[];
    readonly matchCount: number;
    readonly minimumSelectionOverlapPercent: number;
    readonly primaryMarket: MarketSelectionMatch | null;
    readonly selectionAreaSqKm: number;
    readonly unavailableReason: string | null;
  };
  readonly selectionRing: readonly [number, number][];
}): SelectionToolAnalysisSummary {
  const baseSummary = buildEmptySpatialAnalysisSummary(args.selectionRing);
  const facilitiesByPerspective = partitionSelectionFacilities(args.facilitiesFeatures);
  const measureSummary = buildMeasureSelectionSummary({
    ring: args.selectionRing,
    colocationFeatures: facilitiesByPerspective.colocationFeatures,
    hyperscaleFeatures: facilitiesByPerspective.hyperscaleFeatures,
    parcelFeatures: [],
    parcelNextCursor: null,
    parcelTruncated: false,
  });

  return {
    ...baseSummary,
    area: {
      countyIds: measureSummary.countyIds,
      selectionAreaSqKm: args.marketSelection.selectionAreaSqKm,
    },
    summary: {
      ...baseSummary.summary,
      ...measureSummary,
      marketSelection: args.marketSelection,
    },
  };
}

function queryLargeSelectionToolSummaryEffect(
  args: QuerySelectionToolSummaryArgs
): Effect.Effect<QuerySelectionToolSummaryResult, never, never> {
  return Effect.gen(function* () {
    const perspectives = listVisiblePerspectives(args.visiblePerspectives);
    const geometry = selectionGeometryFromRing(args.selectionRing);
    const selectionBbox = buildSelectionRingBbox(args.selectionRing);

    const marketsRequest: MarketsSelectionRequest = {
      geometry,
      limit: 25,
      minimumSelectionOverlapPercent: args.minimumMarketSelectionOverlapPercent ?? 0,
    };

    const facilitiesResults =
      selectionBbox === null
        ? []
        : yield* Effect.all(
            perspectives.map((perspective) =>
              Effect.either(
                fetchFacilitiesByBboxEffect({
                  bbox: selectionBbox,
                  limit: 2000,
                  perspective,
                } satisfies FacilitiesBboxRequest)
              )
            )
          );
    const marketsResult = yield* Effect.either(
      fetchMarketsBySelectionEffect(marketsRequest, args.signal)
    );

    for (const facilitiesResult of facilitiesResults) {
      if (Either.isLeft(facilitiesResult) && facilitiesResult.left instanceof ApiAbortedError) {
        return {
          ok: false,
          reason: "aborted",
        } satisfies QuerySelectionToolSummaryResult;
      }
    }

    if (Either.isLeft(marketsResult) && marketsResult.left instanceof ApiAbortedError) {
      return {
        ok: false,
        reason: "aborted",
      } satisfies QuerySelectionToolSummaryResult;
    }

    const hasFacilitiesError = facilitiesResults.some((r) => Either.isLeft(r));
    const hasMarketsError = Either.isLeft(marketsResult);

    if (hasFacilitiesError || hasMarketsError) {
      yield* Effect.sync(() => {
        publishSelectionProgress(
          args,
          buildSelectionProgress([
            hasFacilitiesError
              ? createProgressStage("facilities", "error", "Failed to load facilities.", 0)
              : createProgressStage("facilities", "complete", "Facilities loaded.", perspectives.length, perspectives.length),
            hasMarketsError
              ? createProgressStage("markets", "error", "Failed to load markets.", 0)
              : createProgressStage("markets", "complete", "Markets loaded.", 1),
            createProgressStage("parcels", "skipped", "Parcel enrichment disabled.", 1),
          ])
        );
      });
    }

    const facilitiesFeatures = facilitiesResults.flatMap((facilitiesResult) =>
      Either.isRight(facilitiesResult) ? facilitiesResult.right.data.features : []
    );
    const marketSelection = Either.isRight(marketsResult)
      ? {
          markets: marketsResult.right.data.matchedMarkets,
          matchCount: marketsResult.right.data.selection.matchCount,
          minimumSelectionOverlapPercent:
            marketsResult.right.data.selection.minimumSelectionOverlapPercent,
          primaryMarket: marketsResult.right.data.primaryMarket,
          selectionAreaSqKm: marketsResult.right.data.selection.selectionAreaSqKm,
          unavailableReason: null,
        }
      : {
          markets: [],
          matchCount: 0,
          minimumSelectionOverlapPercent: args.minimumMarketSelectionOverlapPercent ?? 0,
          primaryMarket: null,
          selectionAreaSqKm: 0,
          unavailableReason: null,
        };

    const summary = buildLargeSelectionFallbackSummary({
      facilitiesFeatures,
      marketSelection,
      selectionRing: args.selectionRing,
    });

    yield* Effect.sync(() => {
      publishSelectionProgress(
        args,
        completedSelectionProgress({
          includeParcels: false,
          marketCount: summary.summary.marketSelection?.matchCount ?? 0,
          parcelCount: 0,
          perspectiveCount: perspectives.length,
          totalFacilityCount: summary.summary.totalCount,
        })
      );
    });

    return {
      ok: true,
      value: {
        errorMessage: null,
        summary,
      },
    } satisfies QuerySelectionToolSummaryResult;
  });
}

export function buildEmptySelectionToolSummary(
  selectionRing: readonly [number, number][]
): SelectionToolAnalysisSummary {
  return buildEmptySpatialAnalysisSummary(selectionRing);
}

export function querySelectionToolSummaryEffect(
  args: QuerySelectionToolSummaryArgs
): Effect.Effect<QuerySelectionToolSummaryResult, never, never> {
  return Effect.gen(function* () {
    const selectionExceedsFastAnalysisLimits = selectionRingExceedsFastAnalysisLimits(
      args.selectionRing
    );
    const includeParcels = args.includeParcels === true && !selectionExceedsFastAnalysisLimits;
    const perspectives = listVisiblePerspectives(args.visiblePerspectives);
    const request: SpatialAnalysisSummaryRequest = {
      geometry: selectionGeometryFromRing(args.selectionRing),
      includeFlood: true,
      includeParcels,
      limitPerPerspective: 5000,
      minimumMarketSelectionOverlapPercent: args.minimumMarketSelectionOverlapPercent ?? 0,
      parcelPageSize: 20_000,
      perspectives,
    };

    yield* Effect.sync(() => {
      publishSelectionProgress(
        args,
        createInitialSelectionProgress(perspectives.length, includeParcels)
      );
    });

    if (selectionExceedsFastAnalysisLimits) {
      return yield* queryLargeSelectionToolSummaryEffect({
        ...args,
        includeParcels: false,
      });
    }

    const summaryOptions =
      typeof args.signal === "undefined"
        ? {
            expectedParcelIngestionRunId: args.expectedParcelsIngestionRunId,
          }
        : {
            expectedParcelIngestionRunId: args.expectedParcelsIngestionRunId,
            signal: args.signal,
          };
    const result: Either.Either<
      ApiEffectSuccess<SpatialAnalysisSummaryResponse>,
      ApiEffectError
    > = yield* Effect.either(fetchSpatialAnalysisSummaryEffect(request, summaryOptions));

    if (Either.isLeft(result)) {
      if (result.left instanceof ApiAbortedError) {
        return {
          ok: false,
          reason: "aborted",
        } satisfies QuerySelectionToolSummaryResult;
      }

      yield* Effect.sync(() => {
        publishSelectionProgress(
          args,
          buildSelectionProgress([
            createProgressStage("facilities", "error", "Failed to load facilities.", 0),
            createProgressStage("markets", "error", "Failed to load markets.", 0),
            includeParcels
              ? createProgressStage("parcels", "error", "Failed to load parcels.", 0)
              : createProgressStage("parcels", "skipped", "Parcel enrichment disabled.", 1),
          ])
        );
      });

      return {
        ok: true,
        value: {
          errorMessage: getApiErrorMessage(result.left, "Unable to load spatial analysis summary."),
          summary: buildEmptySpatialAnalysisSummary(args.selectionRing),
        },
      } satisfies QuerySelectionToolSummaryResult;
    }

    const summary = buildSpatialAnalysisSummaryModel(result.right.data);
    yield* Effect.sync(() => {
      publishSelectionProgress(
        args,
        completedSelectionProgress({
          includeParcels,
          marketCount: summary.summary.marketSelection?.matchCount ?? 0,
          parcelCount: summary.summary.parcelSelection.count,
          perspectiveCount: perspectives.length,
          totalFacilityCount: summary.summary.totalCount,
        })
      );
    });

    return {
      ok: true,
      value: {
        errorMessage: readSelectionWarningMessage(result.right.data),
        summary,
      },
    } satisfies QuerySelectionToolSummaryResult;
  });
}

export function exportSelectionToolSummary(summary: SelectionToolAnalysisSummary | null): void {
  exportMeasureSelectionSummary(summary === null ? null : toMeasureSelectionSummary(summary));
}

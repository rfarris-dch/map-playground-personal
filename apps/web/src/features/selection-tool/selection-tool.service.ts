import { ApiAbortedError, getApiErrorMessage } from "@map-migration/core-runtime/api";
import type { SpatialAnalysisHistoryRequest } from "@map-migration/http-contracts/spatial-analysis-history-http";
import type {
  SpatialAnalysisSummaryRequest,
  SpatialAnalysisSummaryResponse,
} from "@map-migration/http-contracts/spatial-analysis-summary-http";
import { Effect } from "effect";
import { exportMeasureSelectionSummary } from "@/features/app/measure-selection/measure-selection-export.service";
import type { MeasureSelectionSummary } from "@/features/measure/measure-analysis.types";
import {
  selectionGeometryFromRing,
  selectionRingExceedsFastAnalysisLimits,
} from "@/features/selection/selection-analysis-request.service";
import type {
  QuerySelectionToolSummaryArgs,
  QuerySelectionToolSummaryResult,
  SelectionToolAnalysisSummary,
  SelectionToolProgress,
  SelectionToolProgressStageKey,
} from "@/features/selection-tool/selection-tool.types";
import { fetchSpatialAnalysisHistoryEffect } from "@/features/spatial-analysis/spatial-analysis-history.api";
import type { SpatialAnalysisHistoryModel } from "@/features/spatial-analysis/spatial-analysis-history.types";
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
    history: "History",
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
    perspectiveCount > 0
      ? createProgressStage("history", "running", "Loading live quarterly history…")
      : createProgressStage("history", "skipped", "No facility layers enabled.", 1),
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
  readonly historyPointCount: number;
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
    args.perspectiveCount > 0
      ? createProgressStage(
          "history",
          "complete",
          `${args.historyPointCount} live quarters loaded.`,
          1
        )
      : createProgressStage("history", "skipped", "No facility layers enabled.", 1),
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

function buildSelectionHistoryRequest(
  request: SpatialAnalysisSummaryRequest
): SpatialAnalysisHistoryRequest {
  return {
    geometry: request.geometry,
    periodLimit: 12,
    perspectives: request.perspectives,
  };
}

function buildUnavailableSelectionHistory(
  unavailableReason: string | null
): SpatialAnalysisHistoryModel {
  return {
    coverageStatus: "none",
    geometryBasis: "current",
    includedColocationFacilityCount: 0,
    includedFacilityCount: 0,
    includedHyperscaleFacilityCount: 0,
    leasedOverlayAvailable: false,
    leasedOverlayReason:
      "Hyperscale leased totals are modeled at market plus company plus year and are not allocated to drawn selection areas.",
    pointCount: 0,
    points: [],
    publicationBasis: "live_only",
    selectedColocationFacilityCount: 0,
    selectedFacilityCount: 0,
    selectedHyperscaleFacilityCount: 0,
    selectedMarketCount: 0,
    unavailableReason: unavailableReason ?? "History is unavailable for this selection.",
  };
}

function readSelectionWarningMessage(response: SpatialAnalysisSummaryResponse): string | null {
  const parcelWarning =
    response.warnings.find((warning) => warning.code === "PARCELS_POLICY_REJECTED") ?? null;
  return parcelWarning?.message ?? null;
}

function querySelectionHistoryEffect(args: {
  readonly request: SpatialAnalysisHistoryRequest;
  readonly signal: AbortSignal | undefined;
}): Effect.Effect<
  {
    readonly aborted: boolean;
    readonly history: SpatialAnalysisHistoryModel | null;
  },
  never,
  never
> {
  const options =
    typeof args.signal === "undefined"
      ? {}
      : {
          signal: args.signal,
        };

  return fetchSpatialAnalysisHistoryEffect(args.request, options).pipe(
    Effect.map((result) => ({
      aborted: false,
      history: result.data.summary,
    })),
    Effect.catchAll(
      (
        error
      ): Effect.Effect<
        {
          readonly aborted: boolean;
          readonly history: SpatialAnalysisHistoryModel | null;
        },
        never,
        never
      > => {
        if (error instanceof ApiAbortedError) {
          return Effect.succeed({
            aborted: true,
            history: null,
          });
        }

        return Effect.succeed({
          aborted: false,
          history: buildUnavailableSelectionHistory(
            getApiErrorMessage(error, "Live quarterly history is unavailable for this selection.")
          ),
        });
      }
    )
  );
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
      includeFacilities: true,
      includeFlood: true,
      includeParcels,
      limitPerPerspective: 5000,
      minimumMarketSelectionOverlapPercent: args.minimumMarketSelectionOverlapPercent ?? 0,
      parcelPageSize: 20_000,
      perspectives,
    };
    const historyRequest = buildSelectionHistoryRequest(request);

    yield* Effect.sync(() => {
      publishSelectionProgress(
        args,
        createInitialSelectionProgress(perspectives.length, includeParcels)
      );
    });

    const summaryOptions =
      typeof args.signal === "undefined"
        ? {
            expectedParcelIngestionRunId: args.expectedParcelsIngestionRunId,
          }
        : {
            expectedParcelIngestionRunId: args.expectedParcelsIngestionRunId,
            signal: args.signal,
          };
    return yield* fetchSpatialAnalysisSummaryEffect(request, summaryOptions).pipe(
      Effect.flatMap((result) =>
        querySelectionHistoryEffect({
          request: historyRequest,
          signal: args.signal,
        }).pipe(
          Effect.map((historyResult) => {
            if (historyResult.aborted) {
              return {
                ok: false,
                reason: "aborted",
              } satisfies QuerySelectionToolSummaryResult;
            }

            const summary = {
              ...buildSpatialAnalysisSummaryModel(result.data),
              history: historyResult.history,
            };
            publishSelectionProgress(
              args,
              completedSelectionProgress({
                historyPointCount: summary.history?.pointCount ?? 0,
                includeParcels,
                marketCount: summary.summary.marketSelection?.matchCount ?? 0,
                parcelCount: summary.summary.parcelSelection.count,
                perspectiveCount: perspectives.length,
                totalFacilityCount: summary.summary.totalCount,
              })
            );

            return {
              ok: true,
              value: {
                errorMessage: readSelectionWarningMessage(result.data),
                summary,
              },
            } satisfies QuerySelectionToolSummaryResult;
          })
        )
      ),
      Effect.catchAll((error): Effect.Effect<QuerySelectionToolSummaryResult, never, never> => {
        if (error instanceof ApiAbortedError) {
          return Effect.succeed({
            ok: false,
            reason: "aborted",
          } satisfies QuerySelectionToolSummaryResult);
        }

        publishSelectionProgress(
          args,
          buildSelectionProgress([
            createProgressStage("facilities", "error", "Failed to load facilities.", 0),
            createProgressStage("history", "error", "Failed to load live quarterly history.", 0),
            createProgressStage("markets", "error", "Failed to load markets.", 0),
            includeParcels
              ? createProgressStage("parcels", "error", "Failed to load parcels.", 0)
              : createProgressStage("parcels", "skipped", "Parcel enrichment disabled.", 1),
          ])
        );

        return Effect.succeed({
          ok: true,
          value: {
            errorMessage: getApiErrorMessage(error, "Unable to load spatial analysis summary."),
            summary: buildEmptySpatialAnalysisSummary(args.selectionRing),
          },
        } satisfies QuerySelectionToolSummaryResult);
      })
    );
  });
}

export function exportSelectionToolSummary(summary: SelectionToolAnalysisSummary | null): void {
  exportMeasureSelectionSummary(summary === null ? null : toMeasureSelectionSummary(summary));
}

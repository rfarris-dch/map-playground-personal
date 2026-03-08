import type {
  SpatialAnalysisSummaryRequest,
  SpatialAnalysisSummaryResponse,
} from "@map-migration/contracts";
import { Effect, Either } from "effect";
import { exportMeasureSelectionSummary } from "@/features/app/measure-selection/measure-selection-export.service";
import type { MeasureSelectionSummary } from "@/features/measure/measure-analysis.types";
import { selectionGeometryFromRing } from "@/features/selection/selection-analysis-request.service";
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
import { ApiAbortedError, getApiErrorMessage } from "@/lib/effect/errors";
import { runBrowserEffect } from "@/lib/effect/runtime";

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

export function buildEmptySelectionToolSummary(
  selectionRing: readonly [number, number][]
): SelectionToolAnalysisSummary {
  return buildEmptySpatialAnalysisSummary(selectionRing);
}

export function querySelectionToolSummaryEffect(
  args: QuerySelectionToolSummaryArgs
): Effect.Effect<QuerySelectionToolSummaryResult, never, never> {
  return Effect.gen(function* () {
    const includeParcels = args.includeParcels === true;
    const perspectives = listVisiblePerspectives(args.visiblePerspectives);
    const request: SpatialAnalysisSummaryRequest = {
      geometry: selectionGeometryFromRing(args.selectionRing),
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

    const summaryOptions =
      typeof args.signal === "undefined"
        ? {
            expectedParcelIngestionRunId: args.expectedParcelsIngestionRunId,
          }
        : {
            expectedParcelIngestionRunId: args.expectedParcelsIngestionRunId,
            signal: args.signal,
          };
    const result = yield* Effect.either(fetchSpatialAnalysisSummaryEffect(request, summaryOptions));

    if (Either.isLeft(result)) {
      if (result.left instanceof ApiAbortedError) {
        return {
          ok: false,
          reason: "aborted",
        } satisfies QuerySelectionToolSummaryResult;
      }
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

export function querySelectionToolSummary(
  args: QuerySelectionToolSummaryArgs
): Promise<QuerySelectionToolSummaryResult> {
  if (typeof args.signal === "undefined") {
    return runBrowserEffect(querySelectionToolSummaryEffect(args));
  }

  return runBrowserEffect(querySelectionToolSummaryEffect(args), {
    signal: args.signal,
  });
}

export function exportSelectionToolSummary(summary: SelectionToolAnalysisSummary | null): void {
  exportMeasureSelectionSummary(summary === null ? null : toMeasureSelectionSummary(summary));
}

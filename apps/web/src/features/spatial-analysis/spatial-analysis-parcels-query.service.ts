import type {
  ParcelEnrichRequest,
  ParcelsFeatureCollection,
  Warning,
} from "@map-migration/contracts";
import { Either, Effect } from "effect";
import { fetchParcelsBySelectionEffect } from "@/features/measure/measure-analysis.api";
import type {
  FetchSpatialAnalysisParcelsPagesArgs,
  SpatialAnalysisParcelsPagesResult,
} from "@/features/spatial-analysis/spatial-analysis-parcels-query.service.types";
import {
  type ApiEffectError,
  ApiIngestionRunMismatchError,
  toApiResultFailure,
} from "@/lib/effect/errors";
import { runBrowserEffect } from "@/lib/effect/runtime";

export type { SpatialAnalysisParcelsPagesResult } from "@/features/spatial-analysis/spatial-analysis-parcels-query.service.types";

type SpatialAnalysisParcelsPagesSuccessResult = Extract<
  SpatialAnalysisParcelsPagesResult,
  { ok: true }
>;

function appendWarnings(
  warnings: Map<string, Warning>,
  nextWarnings: readonly Warning[]
): void {
  for (const warning of nextWarnings) {
    warnings.set(`${warning.code}:${warning.message}`, warning);
  }
}

export function fetchSpatialAnalysisParcelsPagesEffect(
  args: FetchSpatialAnalysisParcelsPagesArgs
): Effect.Effect<
  SpatialAnalysisParcelsPagesSuccessResult,
  ApiEffectError | ApiIngestionRunMismatchError,
  never
> {
  return Effect.gen(function* () {
    const parcelsById = new Map<string, ParcelsFeatureCollection["features"][number]>();
    const seenCursors = new Set<string>();
    let cursor = args.request.cursor ?? null;
    let truncated = false;
    let nextCursor: string | null = null;
    let requestId = "";
    let dataVersion = "";
    let sourceMode = "";
    let ingestionRunId: string | null = null;
    let pageCount = 0;
    const warnings = new Map<string, Warning>();

    while (true) {
      const pageRequest: ParcelEnrichRequest = {
        ...args.request,
        cursor,
      };
      const pageResult = yield* fetchParcelsBySelectionEffect(pageRequest, args.signal, {
        expectedIngestionRunId: args.expectedIngestionRunId,
      });
      const pageMeta = pageResult.data.meta;
      if (requestId.length === 0) {
        requestId = pageMeta.requestId;
        dataVersion = pageMeta.dataVersion;
        sourceMode = pageMeta.sourceMode;
        ingestionRunId = pageMeta.ingestionRunId ?? null;
      } else if ((pageMeta.ingestionRunId ?? null) !== ingestionRunId) {
        yield* Effect.fail(
          new ApiIngestionRunMismatchError({
            requestId: pageMeta.requestId,
            expectedIngestionRunId: ingestionRunId,
            actualIngestionRunId: pageMeta.ingestionRunId ?? null,
          })
        );
      }

      appendWarnings(warnings, pageMeta.warnings);

      for (const feature of pageResult.data.features) {
        parcelsById.set(feature.properties.parcelId, feature);
      }

      pageCount += 1;
      const pageNextCursor = pageResult.data.meta.nextCursor ?? null;
      const hasMore = pageResult.data.meta.truncated && pageNextCursor !== null;
      args.onPage?.({
        pageCount,
        parcelCount: parcelsById.size,
        truncated: hasMore,
      });

      if (!hasMore) {
        truncated = false;
        nextCursor = null;
        break;
      }

      if (seenCursors.has(pageNextCursor)) {
        truncated = true;
        nextCursor = pageNextCursor;
        console.error("[map] parcels cursor repeated while paginating", {
          context: args.cursorRepeatLogContext,
          cursor: pageNextCursor,
        });
        break;
      }

      seenCursors.add(pageNextCursor);
      cursor = pageNextCursor;
    }

    return {
      ok: true,
      dataVersion,
      features: [...parcelsById.values()],
      ingestionRunId,
      truncated,
      nextCursor,
      requestId,
      sourceMode,
      warnings: [...warnings.values()],
    } satisfies SpatialAnalysisParcelsPagesSuccessResult;
  });
}

export async function fetchSpatialAnalysisParcelsPages(
  args: FetchSpatialAnalysisParcelsPagesArgs
): Promise<SpatialAnalysisParcelsPagesResult> {
  const runOptions =
    typeof args.signal === "undefined"
      ? undefined
      : {
          signal: args.signal,
        };
  const result = await runBrowserEffect(
    Effect.either(fetchSpatialAnalysisParcelsPagesEffect(args)),
    runOptions
  );

  if (Either.isRight(result)) {
    if (typeof result.right === "undefined") {
      throw new Error("fetchSpatialAnalysisParcelsPagesEffect returned an undefined success value.");
    }

    return result.right;
  }

  if (result.left instanceof ApiIngestionRunMismatchError) {
    return {
      ok: false,
      reason: "ingestion-run-mismatch",
      requestId: result.left.requestId,
      expectedIngestionRunId: result.left.expectedIngestionRunId,
      actualIngestionRunId: result.left.actualIngestionRunId,
    };
  }
  if (typeof result.left === "undefined") {
    throw new Error("fetchSpatialAnalysisParcelsPagesEffect returned an undefined failure.");
  }

  return toApiResultFailure(result.left);
}

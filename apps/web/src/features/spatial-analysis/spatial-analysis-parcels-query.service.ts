import {
  type ApiEffectError,
  type ApiEffectSuccess,
  toApiResultFailure,
} from "@map-migration/core-runtime/api";
import { runEffectPromise } from "@map-migration/core-runtime/effect";
import type { Warning } from "@map-migration/geo-kernel/warning";
import type { SourceMode } from "@map-migration/http-contracts/api-response-meta";
import type {
  ParcelEnrichRequest,
  ParcelsFeatureCollection,
} from "@map-migration/http-contracts/parcels-http";
import { Data, Effect, Either } from "effect";
import { fetchParcelsBySelectionEffect } from "@/features/measure/measure-analysis.api";
import type {
  FetchSpatialAnalysisParcelsPagesArgs,
  SpatialAnalysisParcelsPagesResult,
} from "@/features/spatial-analysis/spatial-analysis-parcels-query.service.types";

export type { SpatialAnalysisParcelsPagesResult } from "@/features/spatial-analysis/spatial-analysis-parcels-query.service.types";

export class ApiIngestionRunMismatchError extends Data.TaggedError("ApiIngestionRunMismatchError")<{
  readonly actualIngestionRunId: string | null;
  readonly expectedIngestionRunId: string | null;
  readonly requestId: string;
}> {}

type SpatialAnalysisParcelsPagesSuccessResult = Extract<
  SpatialAnalysisParcelsPagesResult,
  { ok: true }
>;
type ParcelsSelectionPage = ApiEffectSuccess<ParcelsFeatureCollection>;

interface SpatialAnalysisParcelsPaginationState {
  cursor: string | null;
  dataVersion: string;
  ingestionRunId: string | null;
  readonly maxPageCount: number | null;
  nextCursor: string | null;
  pageCount: number;
  readonly parcelsById: Map<string, ParcelsFeatureCollection["features"][number]>;
  requestId: string;
  readonly seenCursors: Set<string>;
  sourceMode: SourceMode;
  truncated: boolean;
  readonly warnings: Map<string, Warning>;
}

function appendWarnings(warnings: Map<string, Warning>, nextWarnings: readonly Warning[]): void {
  for (const warning of nextWarnings) {
    warnings.set(`${warning.code}:${warning.message}`, warning);
  }
}

function createPageRequest(
  args: FetchSpatialAnalysisParcelsPagesArgs,
  cursor: string | null
): ParcelEnrichRequest {
  return {
    ...args.request,
    cursor,
  };
}

function initializeSpatialAnalysisMeta(pageResult: ParcelsSelectionPage): {
  readonly dataVersion: string;
  readonly ingestionRunId: string | null;
  readonly requestId: string;
  readonly sourceMode: SourceMode;
} {
  return {
    requestId: pageResult.data.meta.requestId,
    dataVersion: pageResult.data.meta.dataVersion,
    sourceMode: pageResult.data.meta.sourceMode,
    ingestionRunId: pageResult.data.meta.ingestionRunId ?? null,
  };
}

function getNextPageCursor(pageResult: ParcelsSelectionPage): string | null {
  const pageNextCursor = pageResult.data.meta.nextCursor ?? null;
  return pageResult.data.meta.truncated && pageNextCursor !== null ? pageNextCursor : null;
}

function resolveMaxPageCount(maxPageCount: number | undefined): number | null {
  if (typeof maxPageCount !== "number" || !Number.isFinite(maxPageCount) || maxPageCount <= 0) {
    return null;
  }

  return Math.floor(maxPageCount);
}

function createPaginationState(
  args: FetchSpatialAnalysisParcelsPagesArgs
): SpatialAnalysisParcelsPaginationState {
  return {
    cursor: args.request.cursor ?? null,
    dataVersion: "",
    maxPageCount: resolveMaxPageCount(args.maxPageCount),
    ingestionRunId: null,
    nextCursor: null,
    pageCount: 0,
    parcelsById: new Map<string, ParcelsFeatureCollection["features"][number]>(),
    requestId: "",
    seenCursors: new Set<string>(),
    sourceMode: "postgis",
    truncated: false,
    warnings: new Map<string, Warning>(),
  };
}

function readIngestionRunMismatchError(
  state: SpatialAnalysisParcelsPaginationState,
  pageResult: ParcelsSelectionPage
): ApiIngestionRunMismatchError | null {
  const pageMeta = pageResult.data.meta;
  if (state.requestId.length === 0) {
    const initialMeta = initializeSpatialAnalysisMeta(pageResult);
    state.requestId = initialMeta.requestId;
    state.dataVersion = initialMeta.dataVersion;
    state.sourceMode = initialMeta.sourceMode;
    state.ingestionRunId = initialMeta.ingestionRunId;
    return null;
  }

  const pageIngestionRunId = pageMeta.ingestionRunId ?? null;
  if (pageIngestionRunId === state.ingestionRunId) {
    return null;
  }

  return new ApiIngestionRunMismatchError({
    requestId: pageMeta.requestId,
    expectedIngestionRunId: state.ingestionRunId,
    actualIngestionRunId: pageIngestionRunId,
  });
}

function appendPageFeatures(
  state: SpatialAnalysisParcelsPaginationState,
  pageResult: ParcelsSelectionPage
): void {
  appendWarnings(state.warnings, pageResult.data.meta.warnings);

  for (const feature of pageResult.data.features) {
    state.parcelsById.set(feature.properties.parcelId, feature);
  }
}

function reportPageProgress(
  args: FetchSpatialAnalysisParcelsPagesArgs,
  state: SpatialAnalysisParcelsPaginationState,
  pageNextCursor: string | null
): void {
  const hasMore = pageNextCursor !== null;
  args.onPage?.({
    pageCount: state.pageCount,
    parcelCount: state.parcelsById.size,
    truncated: hasMore,
  });
}

function finishPaginationWithNextCursor(
  state: SpatialAnalysisParcelsPaginationState,
  pageNextCursor: string
): void {
  state.truncated = true;
  state.nextCursor = pageNextCursor;
}

function advancePaginationState(
  state: SpatialAnalysisParcelsPaginationState,
  pageNextCursor: string | null,
  cursorRepeatLogContext: string
): boolean {
  if (pageNextCursor === null) {
    state.truncated = false;
    state.nextCursor = null;
    return true;
  }

  if (state.maxPageCount !== null && state.pageCount >= state.maxPageCount) {
    finishPaginationWithNextCursor(state, pageNextCursor);
    return true;
  }

  if (state.seenCursors.has(pageNextCursor)) {
    finishPaginationWithNextCursor(state, pageNextCursor);
    console.error("[map] parcels cursor repeated while paginating", {
      context: cursorRepeatLogContext,
      cursor: pageNextCursor,
    });
    return true;
  }

  state.seenCursors.add(pageNextCursor);
  state.cursor = pageNextCursor;
  return false;
}

function buildSpatialAnalysisParcelsSuccessResult(
  state: SpatialAnalysisParcelsPaginationState
): SpatialAnalysisParcelsPagesSuccessResult {
  return {
    ok: true,
    dataVersion: state.dataVersion,
    features: [...state.parcelsById.values()],
    ingestionRunId: state.ingestionRunId,
    truncated: state.truncated,
    nextCursor: state.nextCursor,
    requestId: state.requestId,
    sourceMode: state.sourceMode,
    warnings: [...state.warnings.values()],
  };
}

export function fetchSpatialAnalysisParcelsPagesEffect(
  args: FetchSpatialAnalysisParcelsPagesArgs
): Effect.Effect<
  SpatialAnalysisParcelsPagesSuccessResult,
  ApiEffectError | ApiIngestionRunMismatchError,
  never
> {
  return Effect.gen(function* () {
    const state = createPaginationState(args);

    while (true) {
      const pageRequest = createPageRequest(args, state.cursor);
      const pageResult: ParcelsSelectionPage = yield* fetchParcelsBySelectionEffect(
        pageRequest,
        args.signal,
        {
          expectedIngestionRunId: args.expectedIngestionRunId,
        }
      );
      const ingestionRunMismatchError = readIngestionRunMismatchError(state, pageResult);
      if (ingestionRunMismatchError !== null) {
        yield* Effect.fail(ingestionRunMismatchError);
      }

      appendPageFeatures(state, pageResult);
      state.pageCount += 1;
      const pageNextCursor = getNextPageCursor(pageResult);
      reportPageProgress(args, state, pageNextCursor);

      if (advancePaginationState(state, pageNextCursor, args.cursorRepeatLogContext)) {
        break;
      }
    }

    return buildSpatialAnalysisParcelsSuccessResult(state);
  });
}

export async function fetchSpatialAnalysisParcelsPages(
  args: FetchSpatialAnalysisParcelsPagesArgs
): Promise<SpatialAnalysisParcelsPagesResult> {
  const result: Either.Either<
    SpatialAnalysisParcelsPagesSuccessResult,
    ApiEffectError | ApiIngestionRunMismatchError
  > = await runEffectPromise(
    Effect.either(fetchSpatialAnalysisParcelsPagesEffect(args)),
    args.signal
  );

  if (Either.isRight(result)) {
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
  return toApiResultFailure(result.left);
}

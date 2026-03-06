import type {
  ParcelEnrichRequest,
  ParcelsFeatureCollection,
  Warning,
} from "@map-migration/contracts";
import { fetchParcelsBySelection } from "@/features/measure/measure-analysis.api";
import type {
  FetchSpatialAnalysisParcelsPagesArgs,
  SpatialAnalysisParcelsPagesResult,
} from "@/features/spatial-analysis/spatial-analysis-parcels-query.service.types";

export type { SpatialAnalysisParcelsPagesResult } from "@/features/spatial-analysis/spatial-analysis-parcels-query.service.types";

export async function fetchSpatialAnalysisParcelsPages(
  args: FetchSpatialAnalysisParcelsPagesArgs
): Promise<SpatialAnalysisParcelsPagesResult> {
  const parcelsById = new Map<string, ParcelsFeatureCollection["features"][number]>();
  const seenCursors = new Set<string>();
  let cursor = args.request.cursor ?? null;
  let truncated = false;
  let nextCursor: string | null = null;
  let requestId = "";
  let dataVersion = "";
  let sourceMode = "";
  let ingestionRunId: string | null = null;
  const warnings = new Map<string, Warning>();

  function appendWarnings(nextWarnings: readonly Warning[]): void {
    for (const warning of nextWarnings) {
      warnings.set(`${warning.code}:${warning.message}`, warning);
    }
  }

  while (true) {
    const pageRequest: ParcelEnrichRequest = {
      ...args.request,
      cursor,
    };
    const pageResult = await fetchParcelsBySelection(pageRequest, args.signal, {
      expectedIngestionRunId: args.expectedIngestionRunId,
    });
    if (!pageResult.ok) {
      return pageResult;
    }

    const pageMeta = pageResult.data.meta;
    if (requestId.length === 0) {
      requestId = pageMeta.requestId;
      dataVersion = pageMeta.dataVersion;
      sourceMode = pageMeta.sourceMode;
      ingestionRunId = pageMeta.ingestionRunId ?? null;
    } else if ((pageMeta.ingestionRunId ?? null) !== ingestionRunId) {
      return {
        ok: false,
        reason: "ingestion-run-mismatch",
        requestId: pageMeta.requestId,
        expectedIngestionRunId: ingestionRunId,
        actualIngestionRunId: pageMeta.ingestionRunId ?? null,
      };
    }

    appendWarnings(pageMeta.warnings);

    for (const feature of pageResult.data.features) {
      parcelsById.set(feature.properties.parcelId, feature);
    }

    const pageNextCursor = pageResult.data.meta.nextCursor ?? null;
    const hasMore = pageResult.data.meta.truncated && pageNextCursor !== null;
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
  };
}

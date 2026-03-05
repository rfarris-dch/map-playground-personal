import type { ParcelEnrichRequest, ParcelsFeatureCollection } from "@map-migration/contracts";
import { fetchParcelsBySelection } from "@/features/measure/measure-analysis.api";
import type {
  FetchSpatialAnalysisParcelsPagesArgs,
  SpatialAnalysisParcelsPagesResult,
} from "./spatial-analysis-parcels-query.service.types";

export type { SpatialAnalysisParcelsPagesResult } from "./spatial-analysis-parcels-query.service.types";

export async function fetchSpatialAnalysisParcelsPages(
  args: FetchSpatialAnalysisParcelsPagesArgs
): Promise<SpatialAnalysisParcelsPagesResult> {
  const parcelsById = new Map<string, ParcelsFeatureCollection["features"][number]>();
  const seenCursors = new Set<string>();
  let cursor = args.request.cursor ?? null;
  let truncated = false;
  let nextCursor: string | null = null;

  while (true) {
    const pageRequest: ParcelEnrichRequest = {
      ...args.request,
      cursor,
    };
    const pageResult = await fetchParcelsBySelection(pageRequest, args.signal);
    if (!pageResult.ok) {
      return pageResult;
    }

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
    features: [...parcelsById.values()],
    truncated,
    nextCursor,
  };
}

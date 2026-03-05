import type { ParcelEnrichRequest, ParcelsFeatureCollection } from "@map-migration/contracts";
import type { ParcelsSelectionResult } from "@/features/measure/measure-analysis.api";

export interface FetchSpatialAnalysisParcelsPagesArgs {
  readonly cursorRepeatLogContext: string;
  readonly request: ParcelEnrichRequest;
  readonly signal: AbortSignal;
}

export type SpatialAnalysisParcelsPagesResult =
  | {
      ok: true;
      features: ParcelsFeatureCollection["features"];
      truncated: boolean;
      nextCursor: string | null;
    }
  | Exclude<ParcelsSelectionResult, { ok: true }>;

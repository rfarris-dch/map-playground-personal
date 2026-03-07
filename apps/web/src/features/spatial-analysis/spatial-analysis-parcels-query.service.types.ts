import type {
  ParcelEnrichRequest,
  ParcelsFeatureCollection,
  Warning,
} from "@map-migration/contracts";
import type { ParcelsSelectionResult } from "@/features/measure/measure-analysis.api";

export interface FetchSpatialAnalysisParcelsPagesArgs {
  readonly cursorRepeatLogContext: string;
  readonly expectedIngestionRunId: string | null;
  readonly onPage?: (args: {
    readonly pageCount: number;
    readonly parcelCount: number;
    readonly truncated: boolean;
  }) => void;
  readonly request: ParcelEnrichRequest;
  readonly signal: AbortSignal;
}

export type SpatialAnalysisParcelsPagesResult =
  | {
      readonly dataVersion: string;
      ok: true;
      features: ParcelsFeatureCollection["features"];
      readonly ingestionRunId: string | null;
      truncated: boolean;
      nextCursor: string | null;
      readonly requestId: string;
      readonly sourceMode: string;
      readonly warnings: readonly Warning[];
    }
  | {
      readonly actualIngestionRunId: string | null;
      readonly expectedIngestionRunId: string | null;
      ok: false;
      readonly reason: "ingestion-run-mismatch";
      readonly requestId: string;
    }
  | Exclude<ParcelsSelectionResult, { ok: true }>;

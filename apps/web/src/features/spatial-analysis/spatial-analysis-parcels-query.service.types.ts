import type { Warning } from "@map-migration/geo-kernel/warning";
import type { SourceMode } from "@map-migration/http-contracts/api-response-meta";
import type {
  ParcelEnrichRequest,
  ParcelsFeatureCollection,
} from "@map-migration/http-contracts/parcels-http";
import type { ParcelsSelectionResult } from "@/features/measure/measure-analysis.api";

export interface FetchSpatialAnalysisParcelsPagesArgs {
  readonly cursorRepeatLogContext: string;
  readonly expectedIngestionRunId: string | null;
  readonly maxPageCount?: number;
  readonly onPage?: (args: {
    readonly pageCount: number;
    readonly parcelCount: number;
    readonly truncated: boolean;
  }) => void;
  readonly request: ParcelEnrichRequest;
  readonly signal?: AbortSignal;
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
      readonly sourceMode: SourceMode;
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

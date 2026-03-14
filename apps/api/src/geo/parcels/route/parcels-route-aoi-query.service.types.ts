import type { Warning } from "@map-migration/geo-kernel";
import type { ParcelRow } from "@/geo/parcels/parcels.repo";

export type EnrichRowsResult = EnrichRowsOk | EnrichRowsError;

export interface EnrichRowsError {
  readonly ok: false;
  readonly response: Response;
}

export interface EnrichRowsOk {
  readonly ok: true;
  readonly rows: ParcelRow[];
  readonly warnings: readonly Warning[];
}

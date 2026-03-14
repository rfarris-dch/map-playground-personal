import type { Warning } from "@map-migration/geo-kernel/warning";
import type { ParcelRow } from "@/geo/parcels/parcels.repo";

export type EnrichRowsResult = EnrichRowsOk | EnrichRowsError;

export interface EnrichRowsError {
  readonly ok: false;
  readonly value: {
    readonly error: unknown;
    readonly message: string;
    readonly reason: "policy_rejected" | "query_failed";
  };
}

export interface EnrichRowsOk {
  readonly ok: true;
  readonly rows: ParcelRow[];
  readonly warnings: readonly Warning[];
}

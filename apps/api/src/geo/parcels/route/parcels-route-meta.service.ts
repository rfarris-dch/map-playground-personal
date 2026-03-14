import { ApiHeaders } from "@map-migration/http-contracts/api-routes";
import type { Context } from "hono";
import { rejectWithConflict } from "@/geo/parcels/route/parcels-route-errors.service";

export function readExpectedIngestionRunId(c: Context): string | null {
  const raw = c.req.header(ApiHeaders.parcelIngestionRunId);
  if (typeof raw !== "string") {
    return null;
  }

  const normalized = raw.trim();
  if (normalized.length === 0) {
    return null;
  }

  return normalized;
}

function ingestionRunMismatch(
  expectedIngestionRunId: string | null,
  actualIngestionRunId: string | undefined
): boolean {
  if (expectedIngestionRunId === null) {
    return false;
  }

  if (typeof actualIngestionRunId !== "string" || actualIngestionRunId.trim().length === 0) {
    return true;
  }

  return expectedIngestionRunId !== actualIngestionRunId.trim();
}

/**
 * Throws an `ApiRouteError` if the expected ingestion run ID does not match
 * the actual ingestion run ID. No-op when there are zero records or when the
 * IDs match (or when no expected ID was supplied).
 */
export function throwIfIngestionRunConflict(
  expectedIngestionRunId: string | null,
  actualIngestionRunId: string | undefined,
  recordCount: number
): void {
  if (recordCount === 0 || !ingestionRunMismatch(expectedIngestionRunId, actualIngestionRunId)) {
    return;
  }

  throw rejectWithConflict(expectedIngestionRunId ?? "", actualIngestionRunId);
}

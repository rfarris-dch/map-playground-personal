import type { SpatialAnalysisFloodSummary } from "@map-migration/http-contracts";
import type { FloodAreaSummaryRow, FloodParcelRollupRow } from "./flood.repo";
import { queryFloodAreaSummary, queryFloodParcelRollup } from "./flood.repo";
import type { QueryFloodAnalysisArgs, QueryFloodAnalysisResult } from "./flood.service.types";

const FLOOD_RELATION_NAME = "environmental_current.flood_hazard";

function clampUnitInterval(value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }

  if (value >= 1) {
    return 1;
  }

  return value;
}

function isMissingRelationError(error: unknown): boolean {
  return (
    error instanceof Error &&
    error.message.includes(FLOOD_RELATION_NAME) &&
    error.message.toLowerCase().includes("does not exist")
  );
}

function parseFiniteNumber(value: number | string | null | undefined, fieldName: string): number {
  if (typeof value === "number") {
    if (Number.isFinite(value)) {
      return value;
    }

    throw new Error(`Invalid numeric value for ${fieldName}`);
  }

  if (typeof value === "string") {
    const normalized = value.trim();
    if (normalized.length === 0) {
      return 0;
    }

    const parsed = Number(normalized);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  throw new Error(`Missing numeric value for ${fieldName}`);
}

function parseNonNegativeInteger(
  value: number | string | null | undefined,
  fieldName: string
): number {
  const parsed = parseFiniteNumber(value, fieldName);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`Invalid integer value for ${fieldName}`);
  }

  return parsed;
}

function parseRequiredText(value: string | null | undefined, fieldName: string): string {
  if (typeof value !== "string") {
    throw new Error(`Missing ${fieldName}`);
  }

  const normalized = value.trim();
  if (normalized.length === 0) {
    throw new Error(`Missing ${fieldName}`);
  }

  return normalized;
}

function mapFloodSummary(
  areaRow: FloodAreaSummaryRow,
  parcelRollupRow: FloodParcelRollupRow
): {
  readonly dataVersion: string;
  readonly runId: string;
  readonly summary: SpatialAnalysisFloodSummary;
} {
  const datasetFeatureCount = parseNonNegativeInteger(
    areaRow.dataset_feature_count,
    "dataset_feature_count"
  );
  if (datasetFeatureCount <= 0) {
    throw new Error("Flood dataset is empty");
  }

  const selectionAreaSqKm = parseFiniteNumber(areaRow.selection_area_sq_km, "selection_area_sq_km");
  const flood100AreaSqKm = parseFiniteNumber(areaRow.flood100_area_sq_km, "flood100_area_sq_km");
  const flood500AreaSqKm = parseFiniteNumber(areaRow.flood500_area_sq_km, "flood500_area_sq_km");

  return {
    dataVersion: parseRequiredText(areaRow.data_version, "data_version"),
    runId: parseRequiredText(areaRow.run_id, "run_id"),
    summary: {
      flood100AreaSqKm,
      flood100SelectionShare:
        selectionAreaSqKm > 0 ? clampUnitInterval(flood100AreaSqKm / selectionAreaSqKm) : 0,
      flood500AreaSqKm,
      flood500SelectionShare:
        selectionAreaSqKm > 0 ? clampUnitInterval(flood500AreaSqKm / selectionAreaSqKm) : 0,
      parcelCountIntersectingFlood100: parseNonNegativeInteger(
        parcelRollupRow.parcel_count_intersecting_flood_100,
        "parcel_count_intersecting_flood_100"
      ),
      parcelCountIntersectingFlood500: parseNonNegativeInteger(
        parcelRollupRow.parcel_count_intersecting_flood_500,
        "parcel_count_intersecting_flood_500"
      ),
      parcelCountOutsideMappedFlood: parseNonNegativeInteger(
        parcelRollupRow.parcel_count_outside_mapped_flood,
        "parcel_count_outside_mapped_flood"
      ),
      selectionAreaSqKm,
      unavailableReason: null,
    },
  };
}

export async function queryFloodAnalysis(
  args: QueryFloodAnalysisArgs
): Promise<QueryFloodAnalysisResult> {
  let areaRows: readonly FloodAreaSummaryRow[];
  try {
    areaRows = await queryFloodAreaSummary(args.geometryGeoJson);
  } catch (error) {
    return {
      ok: false,
      value: {
        error,
        reason: isMissingRelationError(error) ? "source_unavailable" : "query_failed",
      },
    };
  }

  let parcelRows: readonly FloodParcelRollupRow[];
  try {
    parcelRows = await queryFloodParcelRollup(args.geometryGeoJson);
  } catch (error) {
    return {
      ok: false,
      value: {
        error,
        reason: isMissingRelationError(error) ? "source_unavailable" : "query_failed",
      },
    };
  }

  try {
    const areaRow = areaRows[0];
    const parcelRollupRow = parcelRows[0];

    if (typeof areaRow === "undefined" || typeof parcelRollupRow === "undefined") {
      return {
        ok: false,
        value: {
          error: new Error("Flood analysis returned no rows"),
          reason: "source_unavailable",
        },
      };
    }

    return {
      ok: true,
      value: mapFloodSummary(areaRow, parcelRollupRow),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("Flood dataset is empty")) {
      return {
        ok: false,
        value: {
          error,
          reason: "source_unavailable",
        },
      };
    }

    return {
      ok: false,
      value: {
        error,
        reason: "mapping_failed",
      },
    };
  }
}

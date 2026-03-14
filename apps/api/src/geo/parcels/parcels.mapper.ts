import type { ParcelFeature } from "@map-migration/http-contracts/parcels-http";
import type { ParcelRow } from "@/geo/parcels/parcels.repo";
import type { GeometryLike } from "./parcels.mapper.types";

function isObject(value: unknown): value is object {
  return typeof value === "object" && value !== null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return isObject(value) && !Array.isArray(value);
}

function parseJsonValue(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    throw new Error("Invalid JSON payload");
  }
}

function readGeometry(value: unknown): GeometryLike | null {
  if (value === null || typeof value === "undefined") {
    return null;
  }

  const parsed = typeof value === "string" ? parseJsonValue(value) : value;
  if (!isRecord(parsed)) {
    throw new Error("Invalid geometry payload: expected object");
  }

  const type = Reflect.get(parsed, "type");
  const coordinates = Reflect.get(parsed, "coordinates");
  if (typeof type !== "string") {
    throw new Error("Invalid geometry payload: missing type");
  }
  if (typeof coordinates === "undefined") {
    throw new Error("Invalid geometry payload: missing coordinates");
  }

  return {
    type,
    coordinates,
  };
}

function readAttrs(value: unknown): Record<string, unknown> {
  if (typeof value === "string") {
    const parsed = parseJsonValue(value);
    if (isRecord(parsed)) {
      return parsed;
    }
    return {};
  }

  if (isRecord(value)) {
    return value;
  }

  return {};
}

function readNullableString(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  if (normalized.length === 0) {
    return null;
  }

  return normalized;
}

function readState(value: string | null | undefined): string | null {
  const normalized = readNullableString(value);
  if (!normalized) {
    return null;
  }

  if (normalized.length !== 2) {
    return null;
  }

  return normalized.toUpperCase();
}

function readSourceOid(value: number | string | null | undefined): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    const normalized = Math.floor(value);
    return normalized >= 0 ? normalized : null;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      const normalized = Math.floor(parsed);
      return normalized >= 0 ? normalized : null;
    }
  }

  return null;
}

function readIsoTimestamp(value: Date | string | null | undefined): string | null {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      return null;
    }

    return value.toISOString();
  }

  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString();
}

export function mapParcelRowToFeature(row: ParcelRow): ParcelFeature {
  return {
    type: "Feature",
    id: row.parcel_id,
    geometry: readGeometry(row.geom_json),
    properties: {
      parcelId: row.parcel_id,
      state2: readState(row.state2),
      geoid: readNullableString(row.geoid),
      attrs: readAttrs(row.attrs_json),
    },
    lineage: {
      source: "regrid_premium_featureserver",
      sourceOid: readSourceOid(row.source_oid),
      ingestionRunId: readNullableString(row.ingestion_run_id),
      sourceUpdatedAt: readIsoTimestamp(row.source_updated_at),
    },
  };
}

export function mapParcelRowsToFeatures(rows: readonly ParcelRow[]): ParcelFeature[] {
  return rows.map((row) => mapParcelRowToFeature(row));
}

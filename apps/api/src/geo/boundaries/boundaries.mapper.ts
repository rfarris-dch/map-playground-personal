import type { BoundaryPowerFeature, BoundaryPowerLevel, BoundaryPowerProperties } from "@map-migration/http-contracts/boundaries-http";
import type { BoundaryPowerRow } from "@/geo/boundaries/boundaries.repo";
import type { GeoJsonGeometry } from "./boundaries.mapper.types";

function parseJsonObject(input: string): unknown {
  try {
    return JSON.parse(input);
  } catch {
    throw new Error("Invalid geom_json: not valid JSON");
  }
}

function readGeometry(input: unknown): GeoJsonGeometry {
  const value = typeof input === "string" ? parseJsonObject(input) : input;
  if (typeof value !== "object" || value === null) {
    throw new Error("Invalid geom_json: not an object");
  }

  const type = Reflect.get(value, "type");
  const coordinates = Reflect.get(value, "coordinates");
  if (typeof type !== "string" || type.trim().length === 0) {
    throw new Error("Invalid geom_json: missing geometry type");
  }
  if (typeof coordinates === "undefined") {
    throw new Error("Invalid geom_json: missing coordinates");
  }

  return {
    type,
    coordinates,
  };
}

function readCommissionedPowerMw(value: number | string | null | undefined): number {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed >= 0) {
      return parsed;
    }
  }

  throw new Error("Invalid boundary row: commissioned_power_mw must be a nonnegative number");
}

function readRequiredLabel(value: string | null | undefined, field: string): string {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.length > 0) {
      return trimmed;
    }
  }

  throw new Error(`Invalid boundary row: ${field} is required`);
}

function readOptionalLabel(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }

  return trimmed;
}

function toProperties(row: BoundaryPowerRow, level: BoundaryPowerLevel): BoundaryPowerProperties {
  return {
    level,
    regionId: row.region_id,
    regionName: readRequiredLabel(row.region_name, "region_name"),
    parentRegionName: readOptionalLabel(row.parent_region_name),
    commissionedPowerMw: readCommissionedPowerMw(row.commissioned_power_mw),
  };
}

export function mapBoundaryPowerRowsToFeatures(
  rows: readonly BoundaryPowerRow[],
  level: BoundaryPowerLevel
): BoundaryPowerFeature[] {
  return rows.map((row) => ({
    type: "Feature",
    id: row.region_id,
    geometry: readGeometry(row.geom_json),
    properties: toProperties(row, level),
  }));
}

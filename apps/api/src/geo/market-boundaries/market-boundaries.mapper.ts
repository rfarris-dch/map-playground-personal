import { MultiPolygonGeometrySchema, PolygonGeometrySchema } from "@map-migration/geo-kernel/geometry";
import type {
  MarketBoundaryFeature,
  MarketBoundaryLevel,
  MarketBoundaryProperties,
} from "@map-migration/http-contracts/market-boundaries-http";
import type { MarketBoundaryRow } from "@/geo/market-boundaries/market-boundaries.repo";

function parseJsonObject(input: string): unknown {
  try {
    return JSON.parse(input);
  } catch {
    throw new Error("Invalid geom_json: not valid JSON");
  }
}

function readGeometry(input: unknown): MarketBoundaryFeature["geometry"] {
  const value = typeof input === "string" ? parseJsonObject(input) : input;

  const polygon = PolygonGeometrySchema.safeParse(value);
  if (polygon.success) {
    return polygon.data;
  }

  const multiPolygon = MultiPolygonGeometrySchema.safeParse(value);
  if (multiPolygon.success) {
    return multiPolygon.data;
  }

  throw new Error("Invalid geom_json: geometry did not match Polygon/MultiPolygon schema");
}

function readRequiredLabel(value: string | null | undefined, field: string): string {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.length > 0) {
      return trimmed;
    }
  }

  throw new Error(`Invalid market boundary row: ${field} is required`);
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

function readNullableNumber(value: number | string | null | undefined): number | null {
  if (value === null || typeof value === "undefined") {
    return null;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

function readNullableNonnegativeNumber(value: number | string | null | undefined): number | null {
  const num = readNullableNumber(value);
  if (num !== null && num < 0) {
    return null;
  }

  return num;
}

function toProperties(
  row: MarketBoundaryRow,
  level: MarketBoundaryLevel
): MarketBoundaryProperties {
  return {
    level,
    regionId: row.region_id,
    regionName: readRequiredLabel(row.region_name, "region_name"),
    parentRegionName: readOptionalLabel(row.parent_region_name),
    marketId: row.market_id,
    absorption: readNullableNumber(row.absorption),
    vacancy: readNullableNumber(row.vacancy),
    commissionedPowerMw: readNullableNonnegativeNumber(row.commissioned_power_mw),
  };
}

export function mapMarketBoundaryRowsToFeatures(
  rows: readonly MarketBoundaryRow[],
  level: MarketBoundaryLevel
): MarketBoundaryFeature[] {
  return rows.map((row) => ({
    type: "Feature",
    id: row.region_id,
    geometry: readGeometry(row.geom_json),
    properties: toProperties(row, level),
  }));
}

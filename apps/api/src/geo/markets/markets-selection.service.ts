import type { MarketSelectionMatch, Warning } from "@map-migration/contracts";
import type { MarketSelectionRow } from "@/geo/markets/markets-selection.repo";
import { getSelectionAreaSqKm, listMarketsBySelection } from "@/geo/markets/markets-selection.repo";

export type QueryMarketsSelectionResult =
  | {
      readonly ok: true;
      readonly value: {
        readonly matchedMarkets: readonly MarketSelectionMatch[];
        readonly primaryMarket: MarketSelectionMatch | null;
        readonly selectionAreaSqKm: number;
        readonly truncated: boolean;
        readonly warnings: readonly Warning[];
      };
    }
  | {
      readonly ok: false;
      readonly value: {
        readonly error: unknown;
        readonly reason: "boundary_source_unavailable" | "mapping_failed" | "query_failed";
      };
    };

export interface QueryMarketsSelectionArgs {
  readonly geometryGeoJson: string;
  readonly limit: number;
  readonly minimumSelectionOverlapPercent: number;
}

const MARKET_BOUNDARY_RELATION_NAME = "market_current.market_boundaries";

function clampUnitInterval(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  if (value <= 0) {
    return 0;
  }

  if (value >= 1) {
    return 1;
  }

  return value;
}

function parseFiniteNumber(value: number | string | null): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function parseRequiredNumber(value: number | string, fieldName: string): number {
  const parsed = parseFiniteNumber(value);
  if (parsed === null) {
    throw new Error(`Invalid numeric value for ${fieldName}`);
  }

  return parsed;
}

function parseUpdatedAt(value: Date | string | null): string | null {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "string") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.valueOf())) {
      return parsed.toISOString();
    }
  }

  return null;
}

function normalizeText(value: string | null): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function buildMarketCenter(
  row: MarketSelectionRow
): { type: "Point"; coordinates: [number, number] } | null {
  const longitude = parseFiniteNumber(row.longitude);
  const latitude = parseFiniteNumber(row.latitude);
  if (longitude === null || latitude === null) {
    return null;
  }

  return {
    type: "Point",
    coordinates: [longitude, latitude],
  };
}

function toMarketSelectionMatch(
  row: MarketSelectionRow,
  selectionAreaSqKm: number,
  isPrimary: boolean
): MarketSelectionMatch {
  const intersectionAreaSqKm = parseRequiredNumber(
    row.intersection_area_sq_km,
    "intersection_area_sq_km"
  );
  const marketAreaSqKm = parseRequiredNumber(row.market_area_sq_km, "market_area_sq_km");
  const name = normalizeText(row.name);
  if (name === null) {
    throw new Error("Market selection row is missing a market name");
  }

  return {
    absorption: parseFiniteNumber(row.absorption),
    country: normalizeText(row.country),
    intersectionAreaSqKm,
    isPrimary,
    marketCenter: buildMarketCenter(row),
    marketId: String(row.market_id),
    marketOverlapPercent:
      marketAreaSqKm > 0 ? clampUnitInterval(intersectionAreaSqKm / marketAreaSqKm) : 0,
    name,
    region: normalizeText(row.region),
    selectionOverlapPercent:
      selectionAreaSqKm > 0 ? clampUnitInterval(intersectionAreaSqKm / selectionAreaSqKm) : 0,
    state: normalizeText(row.state),
    updatedAt: parseUpdatedAt(row.updated_at),
    vacancy: parseFiniteNumber(row.vacancy),
  };
}

function isMissingRelationError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  return (
    error.message.includes(MARKET_BOUNDARY_RELATION_NAME) &&
    error.message.toLowerCase().includes("does not exist")
  );
}

export async function queryMarketsBySelection(
  args: QueryMarketsSelectionArgs
): Promise<QueryMarketsSelectionResult> {
  let rows: readonly MarketSelectionRow[];
  let selectionAreaSqKm = 0;
  try {
    [rows, selectionAreaSqKm] = await Promise.all([
      listMarketsBySelection({
        geometryGeoJson: args.geometryGeoJson,
        limit: args.limit + 1,
        minimumSelectionOverlapPercent: args.minimumSelectionOverlapPercent,
      }),
      getSelectionAreaSqKm(args.geometryGeoJson),
    ]);
  } catch (error) {
    if (isMissingRelationError(error)) {
      return {
        ok: false,
        value: {
          error,
          reason: "boundary_source_unavailable",
        },
      };
    }

    return {
      ok: false,
      value: {
        error,
        reason: "query_failed",
      },
    };
  }

  try {
    const truncated = rows.length > args.limit;
    const rowsWithinLimit = truncated ? rows.slice(0, args.limit) : rows;
    const matchedMarkets = rowsWithinLimit.map((row, index) =>
      toMarketSelectionMatch(row, selectionAreaSqKm, index === 0)
    );

    return {
      ok: true,
      value: {
        matchedMarkets,
        primaryMarket: matchedMarkets[0] ?? null,
        selectionAreaSqKm,
        truncated,
        warnings: truncated
          ? [
              {
                code: "POSSIBLY_TRUNCATED",
                message: `Returned limit=${String(args.limit)} markets. Increase the selection threshold or refine the AOI if you expected more.`,
              },
            ]
          : [],
      },
    };
  } catch (error) {
    return {
      ok: false,
      value: {
        error,
        reason: "mapping_failed",
      },
    };
  }
}

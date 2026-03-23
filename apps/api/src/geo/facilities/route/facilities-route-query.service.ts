import type { FacilityPerspective } from "@map-migration/geo-kernel/facility-perspective";
import type { FacilitiesDetailResponse } from "@map-migration/http-contracts/facilities-http";
import {
  mapFacilitiesRowsToFeatures,
  mapFacilityDetailRowToFeature,
} from "@/geo/facilities/facilities.mapper";
import {
  countFacilitiesTableRows,
  type FacilitiesBboxRow,
  getFacilityById,
  listFacilitiesByBbox,
  listFacilitiesByPolygon,
  listFacilitiesTableRows,
} from "@/geo/facilities/facilities.repo";
import { mapFacilitiesTableRows } from "@/geo/facilities/facilities-table.mapper";
import type {
  QueryFacilitiesByBboxArgs,
  QueryFacilitiesByBboxResult,
  QueryFacilitiesByPolygonArgs,
  QueryFacilitiesByPolygonResult,
  QueryFacilitiesTableArgs,
  QueryFacilitiesTableResult,
  QueryFacilityDetailArgs,
  QueryFacilityDetailResult,
} from "./facilities-route-query.service.types";

export type {
  QueryFacilitiesByBboxArgs,
  QueryFacilitiesByBboxResult,
  QueryFacilitiesByPolygonArgs,
  QueryFacilitiesByPolygonResult,
  QueryFacilitiesTableArgs,
  QueryFacilitiesTableResult,
  QueryFacilityDetailArgs,
  QueryFacilityDetailResult,
} from "./facilities-route-query.service.types";

function queryFailure(error: unknown) {
  return {
    ok: false as const,
    value: {
      reason: "query_failed" as const,
      error,
    },
  };
}

function mappingFailure(error: unknown) {
  return {
    ok: false as const,
    value: {
      reason: "mapping_failed" as const,
      error,
    },
  };
}

function mapFacilitiesFeatureResult(args: {
  readonly limit: number;
  readonly perspective: FacilityPerspective;
  readonly rows: readonly FacilitiesBboxRow[];
  readonly sqlTimeMs: number;
}): QueryFacilitiesByBboxResult {
  try {
    const mappingStartedAt = globalThis.performance.now();
    const truncated = args.rows.length > args.limit;
    const rowsWithinLimit = truncated ? args.rows.slice(0, args.limit) : args.rows;
    return {
      ok: true,
      value: {
        features: mapFacilitiesRowsToFeatures(rowsWithinLimit, args.perspective),
        timing: {
          mappingTimeMs: globalThis.performance.now() - mappingStartedAt,
          sqlTimeMs: args.sqlTimeMs,
        },
        truncated,
        warnings: truncated
          ? [
              {
                code: "POSSIBLY_TRUNCATED",
                message: `Returned limit=${String(args.limit)} rows. Zoom in if you expected more.`,
              },
            ]
          : [],
      },
    };
  } catch (error) {
    return mappingFailure(error);
  }
}

export async function queryFacilitiesByBbox(
  args: QueryFacilitiesByBboxArgs
): Promise<QueryFacilitiesByBboxResult> {
  try {
    const sqlStartedAt = globalThis.performance.now();
    const rows = await listFacilitiesByBbox({
      ...args.bbox,
      limit: args.limit + 1,
      perspective: args.perspective,
      tables: args.tables,
    });
    return mapFacilitiesFeatureResult({
      rows,
      limit: args.limit,
      perspective: args.perspective,
      sqlTimeMs: globalThis.performance.now() - sqlStartedAt,
    });
  } catch (error) {
    return queryFailure(error);
  }
}

export async function queryFacilitiesByPolygon(
  args: QueryFacilitiesByPolygonArgs
): Promise<QueryFacilitiesByPolygonResult> {
  try {
    const sqlStartedAt = globalThis.performance.now();
    const rows = await listFacilitiesByPolygon({
      geometryGeoJson: args.geometryGeoJson,
      limit: args.limit + 1,
      perspective: args.perspective,
      tables: args.tables,
    });
    return mapFacilitiesFeatureResult({
      rows,
      limit: args.limit,
      perspective: args.perspective,
      sqlTimeMs: globalThis.performance.now() - sqlStartedAt,
    });
  } catch (error) {
    return queryFailure(error);
  }
}

export async function queryFacilitiesTable(
  args: QueryFacilitiesTableArgs
): Promise<QueryFacilitiesTableResult> {
  let rows: Awaited<ReturnType<typeof listFacilitiesTableRows>>;
  let totalCount: number;

  try {
    [totalCount, rows] = await Promise.all([
      countFacilitiesTableRows(args.perspective, args.tables),
      listFacilitiesTableRows({
        perspective: args.perspective,
        limit: args.limit,
        offset: args.offset,
        sortBy: args.sortBy,
        sortOrder: args.sortOrder,
        tables: args.tables,
      }),
    ]);
  } catch (error) {
    return queryFailure(error);
  }

  try {
    return {
      ok: true,
      value: {
        rows: mapFacilitiesTableRows(rows, args.perspective),
        totalCount,
      },
    };
  } catch (error) {
    return mappingFailure(error);
  }
}

export async function queryFacilityDetail(
  args: QueryFacilityDetailArgs
): Promise<QueryFacilityDetailResult> {
  let row: Awaited<ReturnType<typeof getFacilityById>>;

  try {
    row = await getFacilityById(args.facilityId, args.perspective, args.tables);
  } catch (error) {
    return queryFailure(error);
  }

  if (row === null) {
    return {
      ok: false,
      value: {
        reason: "not_found",
      },
    };
  }

  try {
    const feature: FacilitiesDetailResponse["feature"] = mapFacilityDetailRowToFeature(
      row,
      args.perspective
    );
    return {
      ok: true,
      value: {
        feature,
      },
    };
  } catch (error) {
    return mappingFailure(error);
  }
}

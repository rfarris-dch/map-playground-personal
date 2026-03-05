import type {
  FacilitiesDetailResponse,
  FacilitiesFeatureCollection,
  FacilitiesTableResponse,
  FacilityPerspective,
  Warning,
} from "@map-migration/contracts";
import {
  mapFacilitiesRowsToFeatures,
  mapFacilityDetailRowToFeature,
} from "@/geo/facilities/facilities.mapper";
import {
  countFacilitiesTableRows,
  type FacilitiesBboxRow,
  type FacilityDetailRow,
  type FacilityTableRow,
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
  QueryFacilitiesRowsResult,
  QueryFacilitiesTableArgs,
  QueryFacilitiesTableResult,
  QueryFacilitiesTableRowsResult,
  QueryFacilityDetailArgs,
  QueryFacilityDetailResult,
  QueryFacilityDetailRowResult,
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

function queryFacilitiesBboxRows(
  args: QueryFacilitiesByBboxArgs
): Promise<QueryFacilitiesRowsResult> {
  return listFacilitiesByBbox({
    ...args.bbox,
    limit: args.limit + 1,
    perspective: args.perspective,
  }).then(
    (rows) => ({
      ok: true,
      value: rows,
    }),
    (error: unknown) => ({
      ok: false,
      value: {
        error,
      },
    })
  );
}

function queryFacilitiesPolygonRows(
  args: QueryFacilitiesByPolygonArgs
): Promise<QueryFacilitiesRowsResult> {
  return listFacilitiesByPolygon({
    geometryGeoJson: args.geometryGeoJson,
    limit: args.limit + 1,
    perspective: args.perspective,
  }).then(
    (rows) => ({
      ok: true,
      value: rows,
    }),
    (error: unknown) => ({
      ok: false,
      value: {
        error,
      },
    })
  );
}

function mapFacilitiesBboxRows(args: {
  readonly limit: number;
  readonly perspective: FacilityPerspective;
  readonly rows: readonly FacilitiesBboxRow[];
}):
  | {
      readonly ok: true;
      readonly value: {
        readonly features: FacilitiesFeatureCollection["features"];
        readonly truncated: boolean;
        readonly warnings: readonly Warning[];
      };
    }
  | { readonly ok: false; readonly value: { readonly error: unknown } } {
  try {
    const truncated = args.rows.length > args.limit;
    const rowsWithinLimit = truncated ? args.rows.slice(0, args.limit) : args.rows;
    const warnings = truncated
      ? [
          {
            code: "POSSIBLY_TRUNCATED",
            message: `Returned limit=${String(args.limit)} rows. Zoom in if you expected more.`,
          },
        ]
      : [];

    return {
      ok: true,
      value: {
        features: mapFacilitiesRowsToFeatures(rowsWithinLimit, args.perspective),
        truncated,
        warnings,
      },
    };
  } catch (error) {
    return {
      ok: false,
      value: {
        error,
      },
    };
  }
}

function queryFacilitiesTableRows(
  args: QueryFacilitiesTableArgs
): Promise<QueryFacilitiesTableRowsResult> {
  return Promise.all([
    countFacilitiesTableRows(args.perspective),
    listFacilitiesTableRows({
      perspective: args.perspective,
      limit: args.limit,
      offset: args.offset,
      sortBy: args.sortBy,
      sortOrder: args.sortOrder,
    }),
  ]).then(
    ([totalCount, rows]) => ({
      ok: true,
      value: {
        rows,
        totalCount,
      },
    }),
    (error: unknown) => ({
      ok: false,
      value: {
        error,
      },
    })
  );
}

function mapFacilitiesTableData(
  rows: readonly FacilityTableRow[],
  perspective: FacilityPerspective
):
  | { readonly ok: true; readonly value: FacilitiesTableResponse["rows"] }
  | { readonly ok: false; readonly value: { readonly error: unknown } } {
  try {
    return {
      ok: true,
      value: mapFacilitiesTableRows(rows, perspective),
    };
  } catch (error) {
    return {
      ok: false,
      value: {
        error,
      },
    };
  }
}

function queryFacilityDetailRow(
  args: QueryFacilityDetailArgs
): Promise<QueryFacilityDetailRowResult> {
  return getFacilityById(args.facilityId, args.perspective).then(
    (row) => ({
      ok: true,
      value: row,
    }),
    (error: unknown) => ({
      ok: false,
      value: {
        error,
      },
    })
  );
}

function mapFacilityDetailData(
  row: FacilityDetailRow,
  perspective: FacilityPerspective
):
  | { readonly ok: true; readonly value: FacilitiesDetailResponse["feature"] }
  | { readonly ok: false; readonly value: { readonly error: unknown } } {
  try {
    return {
      ok: true,
      value: mapFacilityDetailRowToFeature(row, perspective),
    };
  } catch (error) {
    return {
      ok: false,
      value: {
        error,
      },
    };
  }
}

export async function queryFacilitiesByBbox(
  args: QueryFacilitiesByBboxArgs
): Promise<QueryFacilitiesByBboxResult> {
  const rowsResult = await queryFacilitiesBboxRows(args);
  if (!rowsResult.ok) {
    return {
      ok: false,
      value: {
        reason: "query_failed",
        error: rowsResult.value.error,
      },
    };
  }

  const mappedResult = mapFacilitiesBboxRows({
    rows: rowsResult.value,
    limit: args.limit,
    perspective: args.perspective,
  });
  if (!mappedResult.ok) {
    return {
      ok: false,
      value: {
        reason: "mapping_failed",
        error: mappedResult.value.error,
      },
    };
  }

  return {
    ok: true,
    value: mappedResult.value,
  };
}

export async function queryFacilitiesByPolygon(
  args: QueryFacilitiesByPolygonArgs
): Promise<QueryFacilitiesByPolygonResult> {
  const rowsResult = await queryFacilitiesPolygonRows(args);
  if (!rowsResult.ok) {
    return {
      ok: false,
      value: {
        reason: "query_failed",
        error: rowsResult.value.error,
      },
    };
  }

  const mappedResult = mapFacilitiesBboxRows({
    rows: rowsResult.value,
    limit: args.limit,
    perspective: args.perspective,
  });
  if (!mappedResult.ok) {
    return {
      ok: false,
      value: {
        reason: "mapping_failed",
        error: mappedResult.value.error,
      },
    };
  }

  return {
    ok: true,
    value: mappedResult.value,
  };
}

export async function queryFacilitiesTable(
  args: QueryFacilitiesTableArgs
): Promise<QueryFacilitiesTableResult> {
  const rowsResult = await queryFacilitiesTableRows(args);
  if (!rowsResult.ok) {
    return {
      ok: false,
      value: {
        reason: "query_failed",
        error: rowsResult.value.error,
      },
    };
  }

  const mappedResult = mapFacilitiesTableData(rowsResult.value.rows, args.perspective);
  if (!mappedResult.ok) {
    return {
      ok: false,
      value: {
        reason: "mapping_failed",
        error: mappedResult.value.error,
      },
    };
  }

  return {
    ok: true,
    value: {
      rows: mappedResult.value,
      totalCount: rowsResult.value.totalCount,
    },
  };
}

export async function queryFacilityDetail(
  args: QueryFacilityDetailArgs
): Promise<QueryFacilityDetailResult> {
  const rowResult = await queryFacilityDetailRow(args);
  if (!rowResult.ok) {
    return {
      ok: false,
      value: {
        reason: "query_failed",
        error: rowResult.value.error,
      },
    };
  }

  if (rowResult.value === null) {
    return {
      ok: false,
      value: {
        reason: "not_found",
      },
    };
  }

  const mappedResult = mapFacilityDetailData(rowResult.value, args.perspective);
  if (!mappedResult.ok) {
    return {
      ok: false,
      value: {
        reason: "mapping_failed",
        error: mappedResult.value.error,
      },
    };
  }

  return {
    ok: true,
    value: {
      feature: mappedResult.value,
    },
  };
}

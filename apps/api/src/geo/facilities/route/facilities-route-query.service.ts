import type {
  FacilitiesDetailResponse,
  FacilitiesFeatureCollection,
  FacilitiesTableResponse,
  FacilityPerspective,
  FacilitySortBy,
  SortDirection,
} from "@map-migration/contracts";
import { mapFacilitiesRowsToFeatures, mapFacilityDetailRowToFeature } from "../facilities.mapper";
import {
  countFacilitiesTableRows,
  type FacilitiesBboxRow,
  type FacilityDetailRow,
  type FacilityTableRow,
  getFacilityById,
  listFacilitiesByBbox,
  listFacilitiesTableRows,
} from "../facilities.repo";
import { mapFacilitiesTableRows } from "../facilities-table.mapper";

export interface QueryFacilitiesByBboxArgs {
  readonly bbox: {
    readonly east: number;
    readonly north: number;
    readonly south: number;
    readonly west: number;
  };
  readonly limit: number;
  readonly perspective: FacilityPerspective;
}

export type QueryFacilitiesByBboxResult =
  | {
      readonly ok: true;
      readonly value: {
        readonly features: FacilitiesFeatureCollection["features"];
        readonly truncated: boolean;
        readonly warnings: ReadonlyArray<{ code: string; message: string }>;
      };
    }
  | {
      readonly ok: false;
      readonly value: {
        readonly error: unknown;
        readonly reason: "mapping_failed" | "query_failed";
      };
    };

export interface QueryFacilitiesTableArgs {
  readonly limit: number;
  readonly offset: number;
  readonly perspective: FacilityPerspective;
  readonly sortBy: FacilitySortBy;
  readonly sortOrder: SortDirection;
}

export type QueryFacilitiesTableResult =
  | {
      readonly ok: true;
      readonly value: {
        readonly rows: FacilitiesTableResponse["rows"];
        readonly totalCount: number;
      };
    }
  | {
      readonly ok: false;
      readonly value: {
        readonly error: unknown;
        readonly reason: "mapping_failed" | "query_failed";
      };
    };

export interface QueryFacilityDetailArgs {
  readonly facilityId: string;
  readonly perspective: FacilityPerspective;
}

export type QueryFacilityDetailResult =
  | { readonly ok: true; readonly value: { readonly feature: FacilitiesDetailResponse["feature"] } }
  | {
      readonly ok: false;
      readonly value: {
        readonly error?: unknown;
        readonly reason: "mapping_failed" | "not_found" | "query_failed";
      };
    };

type QueryFacilitiesRowsResult =
  | { readonly ok: true; readonly value: readonly FacilitiesBboxRow[] }
  | { readonly ok: false; readonly value: { readonly error: unknown } };

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
        readonly warnings: ReadonlyArray<{ code: string; message: string }>;
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

type QueryFacilitiesTableRowsResult =
  | {
      readonly ok: true;
      readonly value: { readonly rows: readonly FacilityTableRow[]; readonly totalCount: number };
    }
  | { readonly ok: false; readonly value: { readonly error: unknown } };

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

type QueryFacilityDetailRowResult =
  | { readonly ok: true; readonly value: FacilityDetailRow | null }
  | { readonly ok: false; readonly value: { readonly error: unknown } };

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

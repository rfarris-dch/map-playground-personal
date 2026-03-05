import type { ProviderSortBy, ProviderTableRow, SortDirection } from "@map-migration/contracts";
import { mapProviderRowsToTableRows } from "./providers.mapper";
import { countProviders, listProvidersPage, type ProviderListRow } from "./providers.repo";

export interface QueryProvidersTableArgs {
  readonly limit: number;
  readonly offset: number;
  readonly sortBy: ProviderSortBy;
  readonly sortOrder: SortDirection;
}

export interface QueryProvidersTableSuccess {
  readonly rows: readonly ProviderTableRow[];
  readonly totalCount: number;
}

export type QueryProvidersTableResult =
  | { readonly ok: true; readonly value: QueryProvidersTableSuccess }
  | {
      readonly ok: false;
      readonly value: {
        readonly error: unknown;
        readonly reason: "mapping_failed" | "query_failed";
      };
    };

type QueryProviderRowsResult =
  | {
      readonly ok: true;
      readonly value: { readonly rows: readonly ProviderListRow[]; readonly totalCount: number };
    }
  | { readonly ok: false; readonly value: { readonly error: unknown } };

function mapProvidersRows(
  rows: readonly ProviderListRow[]
):
  | { readonly ok: true; readonly value: readonly ProviderTableRow[] }
  | { readonly ok: false; readonly value: { readonly error: unknown } } {
  try {
    return {
      ok: true,
      value: mapProviderRowsToTableRows(rows),
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

function queryProviderRows(args: QueryProvidersTableArgs): Promise<QueryProviderRowsResult> {
  return Promise.all([
    countProviders(),
    listProvidersPage({
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

export async function queryProvidersTable(
  args: QueryProvidersTableArgs
): Promise<QueryProvidersTableResult> {
  const rowsResult = await queryProviderRows(args);
  if (!rowsResult.ok) {
    return {
      ok: false,
      value: {
        reason: "query_failed",
        error: rowsResult.value.error,
      },
    };
  }

  const mappedRowsResult = mapProvidersRows(rowsResult.value.rows);
  if (!mappedRowsResult.ok) {
    return {
      ok: false,
      value: {
        reason: "mapping_failed",
        error: mappedRowsResult.value.error,
      },
    };
  }

  return {
    ok: true,
    value: {
      rows: mappedRowsResult.value,
      totalCount: rowsResult.value.totalCount,
    },
  };
}

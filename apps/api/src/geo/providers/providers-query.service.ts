import type { ProviderTableRow } from "@map-migration/contracts";
import { mapProviderRowsToTableRows } from "@/geo/providers/providers.mapper";
import {
  countProviders,
  listProvidersPage,
  type ProviderListRow,
} from "@/geo/providers/providers.repo";
import type {
  QueryProviderRowsResult,
  QueryProvidersTableArgs,
  QueryProvidersTableResult,
} from "./providers-query.service.types";

export type {
  QueryProvidersTableArgs,
  QueryProvidersTableResult,
  QueryProvidersTableSuccess,
} from "./providers-query.service.types";

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

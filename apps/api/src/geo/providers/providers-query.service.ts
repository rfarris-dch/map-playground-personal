import type { ProviderTableRow } from "@map-migration/contracts";
import { mapProviderRowsToTableRows } from "@/geo/providers/providers.mapper";
import {
  countProviders,
  listProvidersPage,
  type ProviderListRow,
} from "@/geo/providers/providers.repo";
import type {
  QueryProvidersTableArgs,
  QueryProvidersTableResult,
} from "./providers-query.service.types";

export type {
  QueryProvidersTableArgs,
  QueryProvidersTableResult,
  QueryProvidersTableSuccess,
} from "./providers-query.service.types";

export async function queryProvidersTable(
  args: QueryProvidersTableArgs
): Promise<QueryProvidersTableResult> {
  let rows: readonly ProviderListRow[];
  let totalCount: number;

  try {
    [totalCount, rows] = await Promise.all([
      countProviders(),
      listProvidersPage({
        limit: args.limit,
        offset: args.offset,
        sortBy: args.sortBy,
        sortOrder: args.sortOrder,
      }),
    ]);
  } catch (error) {
    return {
      ok: false,
      value: {
        reason: "query_failed",
        error,
      },
    };
  }

  let mappedRows: readonly ProviderTableRow[];
  try {
    mappedRows = mapProviderRowsToTableRows(rows);
  } catch (error) {
    return {
      ok: false,
      value: {
        reason: "mapping_failed",
        error,
      },
    };
  }

  return {
    ok: true,
    value: {
      rows: mappedRows,
      totalCount,
    },
  };
}

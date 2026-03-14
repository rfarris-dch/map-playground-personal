import type { ProviderTableRow } from "@map-migration/http-contracts/table-contracts";
import { mapProviderRowsToTableRows } from "@/geo/providers/providers.mapper";
import { listProvidersPage, type ProviderListRow } from "@/geo/providers/providers.repo";
import type {
  ProvidersRepoPort,
  QueryProvidersTableArgs,
  QueryProvidersTableResult,
} from "./providers-query.service.types";

export type {
  QueryProvidersTableArgs,
  QueryProvidersTableResult,
  QueryProvidersTableSuccess,
} from "./providers-query.service.types";

const defaultProvidersRepo: ProvidersRepoPort = {
  listProvidersPage,
};

function parseTotalCount(rows: readonly ProviderListRow[]): number {
  const firstRow = rows[0];
  if (firstRow === undefined) {
    return 0;
  }

  const raw = firstRow.total_count;
  const numeric = Number(raw);
  if (!Number.isFinite(numeric) || numeric < 0) {
    return 0;
  }

  return Math.trunc(numeric);
}

export async function queryProvidersTable(
  args: QueryProvidersTableArgs,
  repo: ProvidersRepoPort = defaultProvidersRepo
): Promise<QueryProvidersTableResult> {
  let rows: readonly ProviderListRow[];

  try {
    rows = await repo.listProvidersPage({
      limit: args.limit,
      offset: args.offset,
      sortBy: args.sortBy,
      sortOrder: args.sortOrder,
    });
  } catch (error) {
    return {
      ok: false,
      value: {
        reason: "query_failed",
        error,
      },
    };
  }

  const totalCount = parseTotalCount(rows);

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

import type { MarketTableRow } from "@map-migration/contracts";
import { mapMarketRowsToTableRows } from "@/geo/markets/markets.mapper";
import { countMarkets, listMarketsPage, type MarketListRow } from "@/geo/markets/markets.repo";
import type {
  QueryMarketsRowsResult,
  QueryMarketsTableArgs,
  QueryMarketsTableResult,
} from "./markets-query.service.types";

export type {
  QueryMarketsTableArgs,
  QueryMarketsTableResult,
  QueryMarketsTableSuccess,
} from "./markets-query.service.types";

function mapMarketsRows(
  rows: readonly MarketListRow[]
):
  | { readonly ok: true; readonly value: readonly MarketTableRow[] }
  | { readonly ok: false; readonly value: { readonly error: unknown } } {
  try {
    return {
      ok: true,
      value: mapMarketRowsToTableRows(rows),
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

function queryMarketsRows(args: QueryMarketsTableArgs): Promise<QueryMarketsRowsResult> {
  return Promise.all([
    countMarkets(),
    listMarketsPage({
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

export async function queryMarketsTable(
  args: QueryMarketsTableArgs
): Promise<QueryMarketsTableResult> {
  const rowsResult = await queryMarketsRows(args);
  if (!rowsResult.ok) {
    return {
      ok: false,
      value: {
        reason: "query_failed",
        error: rowsResult.value.error,
      },
    };
  }

  const mappedRowsResult = mapMarketsRows(rowsResult.value.rows);
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

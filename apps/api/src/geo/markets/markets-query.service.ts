import type { MarketSortBy, MarketTableRow, SortDirection } from "@map-migration/contracts";
import { mapMarketRowsToTableRows } from "./markets.mapper";
import { countMarkets, listMarketsPage, type MarketListRow } from "./markets.repo";

export interface QueryMarketsTableArgs {
  readonly limit: number;
  readonly offset: number;
  readonly sortBy: MarketSortBy;
  readonly sortOrder: SortDirection;
}

export interface QueryMarketsTableSuccess {
  readonly rows: readonly MarketTableRow[];
  readonly totalCount: number;
}

export type QueryMarketsTableResult =
  | { readonly ok: true; readonly value: QueryMarketsTableSuccess }
  | {
      readonly ok: false;
      readonly value: {
        readonly error: unknown;
        readonly reason: "mapping_failed" | "query_failed";
      };
    };

type QueryMarketsRowsResult =
  | {
      readonly ok: true;
      readonly value: { readonly rows: readonly MarketListRow[]; readonly totalCount: number };
    }
  | { readonly ok: false; readonly value: { readonly error: unknown } };

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

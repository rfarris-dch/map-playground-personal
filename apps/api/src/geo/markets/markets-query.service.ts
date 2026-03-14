import type { MarketTableRow } from "@map-migration/http-contracts";
import { mapMarketRowsToTableRows } from "@/geo/markets/markets.mapper";
import { countMarkets, listMarketsPage, type MarketListRow } from "@/geo/markets/markets.repo";
import type { QueryMarketsTableArgs, QueryMarketsTableResult } from "./markets-query.service.types";

export type {
  QueryMarketsTableArgs,
  QueryMarketsTableResult,
  QueryMarketsTableSuccess,
} from "./markets-query.service.types";

export async function queryMarketsTable(
  args: QueryMarketsTableArgs
): Promise<QueryMarketsTableResult> {
  let rows: readonly MarketListRow[];
  let totalCount: number;

  try {
    [totalCount, rows] = await Promise.all([
      countMarkets(),
      listMarketsPage({
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

  let mappedRows: readonly MarketTableRow[];
  try {
    mappedRows = mapMarketRowsToTableRows(rows);
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

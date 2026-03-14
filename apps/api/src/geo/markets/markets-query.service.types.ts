import type {
  MarketSortBy,
  MarketTableRow,
  SortDirection,
} from "@map-migration/http-contracts/table-contracts";
import type { MarketListRow } from "@/geo/markets/markets.repo";

export type QueryMarketsRowsResult =
  | {
      readonly ok: true;
      readonly value: { readonly rows: readonly MarketListRow[]; readonly totalCount: number };
    }
  | { readonly ok: false; readonly value: { readonly error: unknown } };

export type QueryMarketsTableResult =
  | { readonly ok: true; readonly value: QueryMarketsTableSuccess }
  | {
      readonly ok: false;
      readonly value: {
        readonly error: unknown;
        readonly reason: "mapping_failed" | "query_failed";
      };
    };

export interface QueryMarketsTableSuccess {
  readonly rows: readonly MarketTableRow[];
  readonly totalCount: number;
}

export interface QueryMarketsTableArgs {
  readonly limit: number;
  readonly offset: number;
  readonly sortBy: MarketSortBy;
  readonly sortOrder: SortDirection;
}

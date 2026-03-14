import type { MarketSortBy } from "@map-migration/http-contracts";
import { runQuery } from "@/db/postgres";
import type { MarketCountRow, MarketListRow, MarketPageQuery } from "./markets.repo.types";

export type { MarketListRow } from "./markets.repo.types";

function parseCount(value: number | string): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) {
    throw new Error("Invalid market count value from database");
  }

  return Math.trunc(numeric);
}

export async function countMarkets(): Promise<number> {
  const rows = await runQuery<MarketCountRow>(
    `
WITH active_markets AS (
  SELECT market_id
  FROM market_current.markets
  WHERE market_id IS NOT NULL
)
SELECT
  COUNT(*)::bigint AS total_count
FROM active_markets;
`,
    []
  );

  const firstRow = rows[0];
  if (typeof firstRow === "undefined") {
    return 0;
  }

  return parseCount(firstRow.total_count);
}

const marketSortSqlByField: Record<MarketSortBy, string> = {
  name: "name",
  region: "region",
  country: "country",
  state: "state",
  absorption: "absorption",
  vacancy: "vacancy",
  updatedAt: "updated_at",
};

export function listMarketsPage(query: MarketPageQuery): Promise<MarketListRow[]> {
  const sortColumn = marketSortSqlByField[query.sortBy];
  const sortDirection = query.sortOrder === "desc" ? "DESC" : "ASC";

  return runQuery<MarketListRow>(
    `
WITH active_markets AS (
  SELECT
    market.market_id,
    COALESCE(NULLIF(BTRIM(market.name), ''), market.market_id) AS name,
    NULLIF(BTRIM(market.region), '') AS region,
    NULLIF(BTRIM(market.country), '') AS country,
    NULLIF(BTRIM(market.state), '') AS state,
    market.absorption,
    market.vacancy,
    market.updated_at
  FROM market_current.markets AS market
  WHERE market.market_id IS NOT NULL
)
SELECT
  market_id,
  name,
  region,
  country,
  state,
  absorption,
  vacancy,
  updated_at
FROM active_markets
ORDER BY ${sortColumn} ${sortDirection} NULLS LAST, name ASC, market_id ASC
LIMIT $1
OFFSET $2;
`,
    [query.limit, query.offset]
  );
}

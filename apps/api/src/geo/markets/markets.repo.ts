import type { MarketSortBy } from "@map-migration/contracts";
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
SELECT
  COUNT(*)::bigint AS total_count
FROM mirror."HAWK_MARKET"
WHERE "NAME" IS NOT NULL
  AND COALESCE("SEARCH_PAGE", 0) = 1;
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
  name: `"NAME"`,
  region: `NULLIF("REGION", '')`,
  country: `NULLIF("COUNTRY", '')`,
  state: `NULLIF("STATE", '')`,
  absorption: `"ABSORPTION"`,
  vacancy: `"VACANCY"`,
  updatedAt: `"DATE_UPDATED"`,
};

export function listMarketsPage(query: MarketPageQuery): Promise<MarketListRow[]> {
  const sortColumn = marketSortSqlByField[query.sortBy];
  const sortDirection = query.sortOrder === "desc" ? "DESC" : "ASC";

  return runQuery<MarketListRow>(
    `
SELECT
  "MARKET_ID"::text AS market_id,
  "NAME" AS name,
  NULLIF("REGION", '') AS region,
  NULLIF("COUNTRY", '') AS country,
  NULLIF("STATE", '') AS state,
  "ABSORPTION" AS absorption,
  "VACANCY" AS vacancy,
  "DATE_UPDATED" AS updated_at
FROM mirror."HAWK_MARKET"
WHERE "NAME" IS NOT NULL
  AND COALESCE("SEARCH_PAGE", 0) = 1
ORDER BY ${sortColumn} ${sortDirection} NULLS LAST, "NAME" ASC, "MARKET_ID" ASC
LIMIT $1
OFFSET $2;
`,
    [query.limit, query.offset]
  );
}

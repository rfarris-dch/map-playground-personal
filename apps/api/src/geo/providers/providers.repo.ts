import type { ProviderSortBy } from "@map-migration/contracts";
import { runQuery } from "@/db/postgres";
import type { ProviderCountRow, ProviderListRow, ProvidersPageQuery } from "./providers.repo.types";

export type { ProviderListRow } from "./providers.repo.types";

function parseCount(value: number | string): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) {
    throw new Error("Invalid provider count value from database");
  }

  return Math.trunc(numeric);
}

export async function countProviders(): Promise<number> {
  const rows = await runQuery<ProviderCountRow>(
    `
SELECT
  COUNT(*)::bigint AS total_count
FROM mirror."HAWK_PROVIDER_PROFILE"
WHERE "NAME" IS NOT NULL
  AND COALESCE("SHOW_PAGE", 0) = 1
  AND COALESCE("ARCHIVED", 'N') = 'N';
`,
    []
  );

  const firstRow = rows[0];
  if (typeof firstRow === "undefined") {
    return 0;
  }

  return parseCount(firstRow.total_count);
}

const providerSortSqlByField: Record<ProviderSortBy, string> = {
  name: `"NAME"`,
  category: `NULLIF("PROVIDER_CATEGORY", '')`,
  country: `NULLIF("COUNTRY", '')`,
  state: `NULLIF("STATE", '')`,
  listingCount: `"NUM_LISTINGS"`,
  updatedAt: `"DATE_UPDATED"`,
};

export function listProvidersPage(query: ProvidersPageQuery): Promise<ProviderListRow[]> {
  const sortColumn = providerSortSqlByField[query.sortBy];
  const sortDirection = query.sortOrder === "desc" ? "DESC" : "ASC";

  return runQuery<ProviderListRow>(
    `
SELECT
  "PROVIDER_PROFILE_ID"::text AS provider_id,
  "NAME" AS name,
  NULLIF("PROVIDER_CATEGORY", '') AS category,
  NULLIF("COUNTRY", '') AS country,
  NULLIF("STATE", '') AS state,
  "NUM_LISTINGS" AS listing_count,
  COALESCE("HYPERSCALE", 0) AS supports_hyperscale,
  COALESCE("RETAIL", 0) AS supports_retail,
  COALESCE("WHOLESALE", 0) AS supports_wholesale,
  "DATE_UPDATED" AS updated_at
FROM mirror."HAWK_PROVIDER_PROFILE"
WHERE "NAME" IS NOT NULL
  AND COALESCE("SHOW_PAGE", 0) = 1
  AND COALESCE("ARCHIVED", 'N') = 'N'
ORDER BY ${sortColumn} ${sortDirection} NULLS LAST, "NAME" ASC, "PROVIDER_PROFILE_ID" ASC
LIMIT $1
OFFSET $2;
`,
    [query.limit, query.offset]
  );
}

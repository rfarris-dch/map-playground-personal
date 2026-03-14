import type { ProviderSortBy } from "@map-migration/http-contracts";
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
WITH provider_metrics AS (
  SELECT
    facility.provider_id,
    MAX(NULLIF(BTRIM(facility.provider_slug), '')) AS provider_slug,
    MAX(NULLIF(BTRIM(facility.state_abbrev), '')) AS state_abbrev,
    COUNT(*) FILTER (WHERE facility.perspective = 'colocation')::bigint AS colocation_listing_count,
    COUNT(*) FILTER (WHERE facility.perspective = 'hyperscale')::bigint AS hyperscale_listing_count,
    MAX(facility.updated_at) AS latest_facility_updated_at
  FROM (
    SELECT
      provider_id,
      provider_slug,
      state_abbrev,
      freshness_ts AS updated_at,
      'colocation'::text AS perspective
    FROM serve.facility_site
    WHERE provider_id IS NOT NULL
    UNION ALL
    SELECT
      provider_id,
      provider_slug,
      state_abbrev,
      freshness_ts AS updated_at,
      'hyperscale'::text AS perspective
    FROM serve.hyperscale_site
    WHERE provider_id IS NOT NULL
  ) AS facility
  GROUP BY facility.provider_id
),
active_providers AS (
  SELECT
    metrics.provider_id
  FROM provider_metrics AS metrics
)
SELECT
  COUNT(*)::bigint AS total_count
FROM active_providers;
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
  name: "name",
  category: "category",
  country: "country",
  state: "state",
  listingCount: "listing_count",
  updatedAt: "updated_at",
};

export function listProvidersPage(query: ProvidersPageQuery): Promise<ProviderListRow[]> {
  const sortColumn = providerSortSqlByField[query.sortBy];
  const sortDirection = query.sortOrder === "desc" ? "DESC" : "ASC";

  return runQuery<ProviderListRow>(
    `
WITH provider_metrics AS (
  SELECT
    facility.provider_id,
    MAX(NULLIF(BTRIM(facility.provider_slug), '')) AS provider_slug,
    MAX(NULLIF(BTRIM(facility.state_abbrev), '')) AS state_abbrev,
    COUNT(*) FILTER (WHERE facility.perspective = 'colocation')::bigint AS colocation_listing_count,
    COUNT(*) FILTER (WHERE facility.perspective = 'hyperscale')::bigint AS hyperscale_listing_count,
    MAX(facility.updated_at) AS latest_facility_updated_at
  FROM (
    SELECT
      provider_id,
      provider_slug,
      state_abbrev,
      freshness_ts AS updated_at,
      'colocation'::text AS perspective
    FROM serve.facility_site
    WHERE provider_id IS NOT NULL
    UNION ALL
    SELECT
      provider_id,
      provider_slug,
      state_abbrev,
      freshness_ts AS updated_at,
      'hyperscale'::text AS perspective
    FROM serve.hyperscale_site
    WHERE provider_id IS NOT NULL
  ) AS facility
  GROUP BY facility.provider_id
),
active_providers AS (
  SELECT
    metrics.provider_id,
    COALESCE(
      NULLIF(BTRIM(provider.provider_name), ''),
      NULLIF(INITCAP(REPLACE(metrics.provider_slug, '-', ' ')), ''),
      metrics.provider_id
    ) AS name,
    provider.category,
    provider.country,
    COALESCE(provider.state, metrics.state_abbrev) AS state,
    (metrics.colocation_listing_count + metrics.hyperscale_listing_count)::bigint AS listing_count,
    (metrics.hyperscale_listing_count > 0) AS supports_hyperscale,
    (metrics.colocation_listing_count > 0) AS supports_colocation,
    COALESCE(provider.updated_at, metrics.latest_facility_updated_at) AS updated_at
  FROM provider_metrics AS metrics
  LEFT JOIN facility_current.providers AS provider
    ON provider.provider_id = metrics.provider_id
)
SELECT
  provider_id,
  name,
  category,
  country,
  state,
  listing_count,
  supports_hyperscale,
  supports_colocation,
  updated_at
FROM active_providers
ORDER BY ${sortColumn} ${sortDirection} NULLS LAST, name ASC, provider_id ASC
LIMIT $1
OFFSET $2;
`,
    [query.limit, query.offset]
  );
}

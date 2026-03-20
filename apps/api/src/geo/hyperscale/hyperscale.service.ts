import { createHash } from "node:crypto";
import { runQuery } from "@/db/postgres";
import type {
  CompanyResolutionRow,
  HyperscaleAggregationPoint,
  HyperscaleAggregationRow,
  HyperscaleLeasedResponse,
  HyperscaleLeasedRow,
  HyperscaleRegionalAggregationPoint,
  HyperscaleRegionalAggregationRow,
} from "./hyperscale.types";

const REQUESTED_MARKET_CTE = `
WITH requested_market AS (
  SELECT
    source_rows.market_id::text AS source_market_id,
    source_rows.name AS market_name,
    xwalk.market_id AS canonical_market_id
  FROM market_source.markets AS source_rows
  INNER JOIN canon.xwalk_market_source AS xwalk
    ON xwalk.source_table = 'HAWK_MARKET'
   AND xwalk.source_pk = source_rows.market_id::text
  WHERE source_rows.payload->>'EXTERNAL_ID' = $1
  LIMIT 1
)
`;

function sha1Hex(value: string): string {
  return createHash("sha1").update(value).digest("hex");
}

function readNullableNumber(value: number | string | null): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function readNumber(value: number | string): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function buildAggregationPoint(row: HyperscaleAggregationRow): HyperscaleAggregationPoint {
  return {
    live: true,
    owned: readNullableNumber(row.owned_power),
    planned: readNullableNumber(row.planned_power),
    quarter: Math.trunc(readNumber(row.quarter_num)),
    underConstruction: readNullableNumber(row.uc_power),
    year: Math.trunc(readNumber(row.year_num)),
  };
}

function buildRegionalAggregationPoint(
  row: HyperscaleRegionalAggregationRow
): HyperscaleRegionalAggregationPoint {
  return {
    ...buildAggregationPoint(row),
    regionId: Math.trunc(readNumber(row.region_id)),
  };
}

async function resolveCanonicalCompanyId(externalCompanyId: string): Promise<string | null> {
  const rows = await runQuery<CompanyResolutionRow>(
    `
SELECT company_id::text AS company_id, source_pk
FROM canon.xwalk_company_source
WHERE source_table = 'HAWK_COMPANY';
`,
    []
  );

  for (const row of rows) {
    if (row.source_pk === externalCompanyId || sha1Hex(row.source_pk) === externalCompanyId) {
      return row.company_id;
    }
  }

  return null;
}

export async function getHyperscaleMarketCapacity(
  marketId: string
): Promise<readonly HyperscaleAggregationPoint[]> {
  const rows = await runQuery<HyperscaleAggregationRow>(
    `
${REQUESTED_MARKET_CTE}
SELECT
  history_rows.year_num,
  history_rows.quarter_num,
  SUM(history_rows.commissioned_mw) AS owned_power,
  SUM(history_rows.under_construction_mw) AS uc_power,
  SUM(history_rows.planned_mw) AS planned_power
FROM requested_market
INNER JOIN serve.facility_capacity_quarterly_live AS history_rows
  ON history_rows.market_id = requested_market.canonical_market_id
WHERE history_rows.perspective = 'hyperscale'
GROUP BY history_rows.year_num, history_rows.quarter_num
ORDER BY history_rows.year_num ASC, history_rows.quarter_num ASC;
`,
    [marketId]
  );

  return rows.map(buildAggregationPoint);
}

export async function getHyperscaleCompanyCapacityGlobal(
  externalCompanyId: string
): Promise<readonly HyperscaleAggregationPoint[] | null> {
  const canonicalCompanyId = await resolveCanonicalCompanyId(externalCompanyId);
  if (canonicalCompanyId === null) {
    return null;
  }

  const rows = await runQuery<HyperscaleAggregationRow>(
    `
SELECT
  history_rows.year_num,
  history_rows.quarter_num,
  SUM(history_rows.commissioned_mw) AS owned_power,
  SUM(history_rows.under_construction_mw) AS uc_power,
  SUM(history_rows.planned_mw) AS planned_power
FROM serve.facility_capacity_quarterly_live AS history_rows
INNER JOIN canon.dim_facility AS facility_dim
  ON facility_dim.facility_id = history_rows.facility_id
WHERE history_rows.perspective = 'hyperscale'
  AND facility_dim.current_company_id = $1::uuid
GROUP BY history_rows.year_num, history_rows.quarter_num
ORDER BY history_rows.year_num ASC, history_rows.quarter_num ASC;
`,
    [canonicalCompanyId]
  );

  return rows.map(buildAggregationPoint);
}

export async function getHyperscaleCompanyCapacityRegional(
  externalCompanyId: string
): Promise<readonly HyperscaleRegionalAggregationPoint[] | null> {
  const canonicalCompanyId = await resolveCanonicalCompanyId(externalCompanyId);
  if (canonicalCompanyId === null) {
    return null;
  }

  const rows = await runQuery<HyperscaleRegionalAggregationRow>(
    `
SELECT
  market_source_rows.world_region_id AS region_id,
  history_rows.year_num,
  history_rows.quarter_num,
  SUM(history_rows.commissioned_mw) AS owned_power,
  SUM(history_rows.under_construction_mw) AS uc_power,
  SUM(history_rows.planned_mw) AS planned_power
FROM serve.facility_capacity_quarterly_live AS history_rows
INNER JOIN canon.dim_facility AS facility_dim
  ON facility_dim.facility_id = history_rows.facility_id
INNER JOIN canon.xwalk_market_source AS market_xwalk
  ON market_xwalk.market_id = history_rows.market_id
 AND market_xwalk.source_table = 'HAWK_MARKET'
INNER JOIN market_source.markets AS market_source_rows
  ON market_source_rows.market_id::text = market_xwalk.source_pk
WHERE history_rows.perspective = 'hyperscale'
  AND facility_dim.current_company_id = $1::uuid
GROUP BY
  market_source_rows.world_region_id,
  history_rows.year_num,
  history_rows.quarter_num
ORDER BY
  market_source_rows.world_region_id ASC,
  history_rows.year_num ASC,
  history_rows.quarter_num ASC;
`,
    [canonicalCompanyId]
  );

  return rows.map(buildRegionalAggregationPoint);
}

export async function getHyperscaleLeasedByMarket(
  marketId: string
): Promise<HyperscaleLeasedResponse | null> {
  const rows = await runQuery<HyperscaleLeasedRow>(
    `
${REQUESTED_MARKET_CTE}
SELECT
  requested_market.market_name,
  company_xwalk.source_pk AS company_source_id,
  leased_rows.company_name,
  leased_rows.leased_total AS lease_total,
  leased_rows.year_num
FROM requested_market
INNER JOIN serve.hyperscale_company_market_leased_yearly AS leased_rows
  ON leased_rows.market_id = requested_market.canonical_market_id
INNER JOIN canon.xwalk_company_source AS company_xwalk
  ON company_xwalk.company_id = leased_rows.company_id
 AND company_xwalk.source_table = 'HAWK_COMPANY'
ORDER BY leased_rows.year_num ASC, leased_rows.company_name ASC;
`,
    [marketId]
  );

  const firstRow = rows[0];
  if (firstRow === undefined) {
    return null;
  }

  return {
    data: rows.map((row) => ({
      companyId: sha1Hex(row.company_source_id),
      companyName: row.company_name,
      leaseTotal: readNumber(row.lease_total),
      year: Math.trunc(readNumber(row.year_num)),
    })),
    id: marketId,
    name: firstRow.market_name,
  };
}

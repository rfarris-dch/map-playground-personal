import { runQuery } from "@/db/postgres";
import type {
  HyperscaleLeasedYearRow,
  HyperscaleMarketLeasedRow,
  ProviderCapacityTotalsRow,
} from "./companies.types";

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

function readRegionName(regionName: string | null): string {
  return regionName === null || regionName.trim().length === 0 ? "Unknown" : regionName;
}

export async function getProviderCapacityTotals(
  companyName: string
): Promise<Record<string, Record<string, number>>> {
  const rows = await runQuery<ProviderCapacityTotalsRow>(
    `
WITH requested_provider AS (
  SELECT provider_id
  FROM facility_current.providers
  WHERE LOWER(provider_name) = LOWER($1)
  LIMIT 1
),
provider_facilities AS (
  SELECT DISTINCT xwalk.facility_id
  FROM requested_provider
  INNER JOIN serve.facility_site AS site
    ON site.provider_id = requested_provider.provider_id
  INNER JOIN canon.xwalk_facility_source AS xwalk
    ON xwalk.source_table = 'BLC_PRODUCT'
   AND site.facility_id = concat('colo:', xwalk.source_pk)
),
latest_live AS (
  SELECT DISTINCT ON (history_rows.facility_id)
    history_rows.facility_id,
    history_rows.market_id,
    history_rows.commissioned_mw,
    history_rows.available_mw,
    history_rows.under_construction_mw,
    history_rows.planned_mw
  FROM serve.facility_capacity_quarterly_live AS history_rows
  INNER JOIN provider_facilities
    ON provider_facilities.facility_id = history_rows.facility_id
  WHERE history_rows.perspective = 'colo'
  ORDER BY history_rows.facility_id, history_rows.year_num DESC, history_rows.quarter_num DESC
)
SELECT
  market_dim.region_name,
  SUM(latest_live.commissioned_mw) AS commissioned_power,
  SUM(latest_live.available_mw) AS available_power,
  SUM(latest_live.under_construction_mw) AS uc_power,
  SUM(latest_live.planned_mw) AS planned_power
FROM latest_live
LEFT JOIN canon.dim_market AS market_dim
  ON market_dim.market_id = latest_live.market_id
GROUP BY market_dim.region_name
ORDER BY market_dim.region_name ASC NULLS LAST;
`,
    [companyName]
  );

  const out: Record<string, Record<string, number>> = {};
  for (const row of rows) {
    out[readRegionName(row.region_name)] = {
      availablePower: readNullableNumber(row.available_power) ?? 0,
      commissionedPower: readNullableNumber(row.commissioned_power) ?? 0,
      plannedPower: readNullableNumber(row.planned_power) ?? 0,
      ucPower: readNullableNumber(row.uc_power) ?? 0,
    };
  }

  return out;
}

export async function getHyperscaleLeasedByYear(
  companyName: string
): Promise<Record<string, Record<string, { leasedPower: number }>>> {
  const rows = await runQuery<HyperscaleLeasedYearRow>(
    `
SELECT
  market_dim.region_name,
  leased_rows.year_num,
  SUM(leased_rows.leased_total) AS leased_power
FROM serve.hyperscale_company_market_leased_yearly AS leased_rows
LEFT JOIN canon.dim_market AS market_dim
  ON market_dim.market_id = leased_rows.market_id
WHERE LOWER(leased_rows.company_name) = LOWER($1)
GROUP BY market_dim.region_name, leased_rows.year_num
ORDER BY market_dim.region_name ASC NULLS LAST, leased_rows.year_num ASC;
`,
    [companyName]
  );

  const out: Record<string, Record<string, { leasedPower: number }>> = {};
  for (const row of rows) {
    const regionName = readRegionName(row.region_name);
    if (out[regionName] === undefined) {
      out[regionName] = {};
    }

    out[regionName][String(row.year_num)] = {
      leasedPower: readNullableNumber(row.leased_power) ?? 0,
    };
  }

  return out;
}

export async function getHyperscaleMarketLeased(
  companyName: string
): Promise<Record<string, Record<string, { leasedPower: number }>>> {
  const rows = await runQuery<HyperscaleMarketLeasedRow>(
    `
SELECT
  market_dim.region_name,
  leased_rows.market_name,
  leased_rows.leased_total AS leased_power
FROM serve.hyperscale_company_market_leased_latest_year AS leased_rows
LEFT JOIN canon.dim_market AS market_dim
  ON market_dim.market_id = leased_rows.market_id
WHERE LOWER(leased_rows.company_name) = LOWER($1)
ORDER BY market_dim.region_name ASC NULLS LAST, leased_rows.market_name ASC;
`,
    [companyName]
  );

  const out: Record<string, Record<string, { leasedPower: number }>> = {};
  for (const row of rows) {
    const regionName = readRegionName(row.region_name);
    if (out[regionName] === undefined) {
      out[regionName] = {};
    }

    out[regionName][row.market_name] = {
      leasedPower: readNullableNumber(row.leased_power) ?? 0,
    };
  }

  return out;
}

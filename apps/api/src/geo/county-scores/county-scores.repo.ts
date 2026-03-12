import { getCountyMetricsQuerySpec } from "@map-migration/geo-sql";
import { runQuery } from "@/db/postgres";
import type { CountyScoreRow, CountyScoresStatusRow } from "./county-scores.repo.types";

export type { CountyScoreRow, CountyScoresStatusRow } from "./county-scores.repo.types";

const TRAILING_SEMICOLON_PATTERN = /;\s*$/;

function requestedCountyValues(count: number): string {
  return Array.from({ length: count }, (_value, index) => `($${String(index + 1)})`).join(", ");
}

function countyScoresSql(countyIdCount: number): string {
  const countyMetricsQuery = getCountyMetricsQuerySpec();
  const countyMetricsSql = countyMetricsQuery.sql.trim().replace(TRAILING_SEMICOLON_PATTERN, "");

  return `
WITH requested_counties (county_fips) AS (
  VALUES ${requestedCountyValues(countyIdCount)}
),
county_metrics AS (
  ${countyMetricsSql}
)
SELECT
  requested_counties.county_fips,
  county.county_fips IS NOT NULL AS has_county_reference,
  county_metrics.county_fips IS NOT NULL AS has_county_score,
  county.county_name,
  county.state_abbrev,
  county_metrics.publication_run_id,
  county_metrics.rank_status,
  county_metrics.attractiveness_tier,
  county_metrics.confidence_badge,
  county_metrics.market_pressure_index,
  county_metrics.demand_pressure_score,
  county_metrics.supply_timeline_score,
  county_metrics.grid_friction_score,
  county_metrics.policy_constraint_score,
  county_metrics.freshness_score,
  county_metrics.source_volatility,
  county_metrics.last_updated_at,
  county_metrics.narrative_summary,
  county_metrics.top_drivers_json,
  county_metrics.deferred_reason_codes_json,
  county_metrics.what_changed_30d_json,
  county_metrics.what_changed_60d_json,
  county_metrics.what_changed_90d_json,
  county_metrics.pillar_value_states_json,
  county_metrics.expected_mw_0_24m,
  county_metrics.expected_mw_24_60m,
  county_metrics.recent_commissioned_mw_24m,
  county_metrics.demand_momentum_qoq,
  county_metrics.provider_entry_count_12m,
  county_metrics.expected_supply_mw_0_36m,
  county_metrics.expected_supply_mw_36_60m,
  county_metrics.signed_ia_mw,
  county_metrics.queue_mw_active,
  county_metrics.queue_project_count_active,
  county_metrics.median_days_in_queue_active,
  county_metrics.past_due_share,
  county_metrics.market_withdrawal_prior,
  county_metrics.congestion_proxy_score,
  county_metrics.planned_upgrade_count,
  county_metrics.heatmap_signal_flag,
  county_metrics.policy_momentum_score,
  county_metrics.moratorium_status,
  county_metrics.public_sentiment_score,
  county_metrics.policy_event_count,
  county_metrics.county_tagged_event_share,
  county_metrics.policy_mapping_confidence,
  county_metrics.transmission_miles_69kv_plus,
  county_metrics.transmission_miles_230kv_plus,
  county_metrics.gas_pipeline_presence_flag,
  county_metrics.gas_pipeline_mileage_county,
  county_metrics.fiber_presence_flag,
  county_metrics.primary_market_id,
  county_metrics.is_seam_county,
  county_metrics.formula_version,
  county_metrics.input_data_version
FROM requested_counties
LEFT JOIN serve.boundary_county_geom_lod1 AS county
  ON county.county_fips = requested_counties.county_fips
LEFT JOIN county_metrics
  ON county_metrics.county_fips = requested_counties.county_fips;`;
}

export function listCountyScores(countyIds: readonly string[]): Promise<CountyScoreRow[]> {
  return runQuery<CountyScoreRow>(countyScoresSql(countyIds.length), [...countyIds]);
}

const COUNTY_SCORES_STATUS_SQL = `
WITH live_counts AS (
  SELECT
    (SELECT COUNT(*)::integer FROM analytics.county_market_pressure_current) AS row_count,
    (SELECT COUNT(*)::integer FROM analytics.dim_county) AS source_county_count
),
latest_publication AS (
  SELECT
    publication_run_id,
    status,
    published_at,
    data_version,
    input_data_version,
    formula_version,
    methodology_id,
    available_feature_families,
    missing_feature_families,
    source_county_count,
    row_count,
    ranked_county_count,
    deferred_county_count,
    blocked_county_count,
    high_confidence_count,
    medium_confidence_count,
    low_confidence_count,
    fresh_county_count
  FROM analytics.fact_publication
  WHERE status = 'published'
  ORDER BY published_at DESC, publication_run_id DESC
  LIMIT 1
)
SELECT
  publication.publication_run_id,
  publication.status AS publication_status,
  publication.published_at,
  publication.data_version,
  publication.input_data_version,
  publication.formula_version,
  publication.methodology_id,
  to_json(COALESCE(publication.available_feature_families, '{}'::text[]))
    AS available_feature_families,
  to_json(COALESCE(publication.missing_feature_families, '{}'::text[]))
    AS missing_feature_families,
  COALESCE(publication.source_county_count, live_counts.source_county_count) AS source_county_count,
  COALESCE(publication.row_count, live_counts.row_count) AS row_count,
  publication.ranked_county_count,
  publication.deferred_county_count,
  publication.blocked_county_count,
  publication.high_confidence_count,
  publication.medium_confidence_count,
  publication.low_confidence_count,
  publication.fresh_county_count
FROM latest_publication AS publication
CROSS JOIN live_counts
UNION ALL
SELECT
  NULL::text,
  NULL::text,
  NULL::timestamptz,
  NULL::text,
  NULL::text,
  NULL::text,
  NULL::text,
  '[]'::json,
  '[]'::json,
  live_counts.source_county_count,
  live_counts.row_count,
  0::integer,
  0::integer,
  0::integer,
  0::integer,
  0::integer,
  0::integer,
  0::integer
FROM live_counts
WHERE NOT EXISTS (SELECT 1 FROM latest_publication);`;

export async function getCountyScoresStatusSnapshot(): Promise<CountyScoresStatusRow> {
  const rows = await runQuery<CountyScoresStatusRow>(COUNTY_SCORES_STATUS_SQL, []);
  const firstRow = rows[0];
  if (typeof firstRow === "undefined") {
    throw new Error("missing county scores status row");
  }

  return firstRow;
}

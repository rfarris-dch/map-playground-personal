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
  county_metrics.data_version,
  county_metrics.composite_score,
  county_metrics.demand_score,
  county_metrics.generation_score,
  county_metrics.policy_score,
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
    (SELECT COUNT(*)::integer FROM analytics.county_scores_v1) AS score_row_count,
    (SELECT COUNT(*)::integer FROM analytics.county_metrics_v1) AS metrics_row_count,
    (SELECT COUNT(*)::integer FROM serve.boundary_county_geom_lod1) AS live_source_county_count
),
latest_publication AS (
  SELECT
    run_id,
    status,
    published_at,
    data_version,
    input_data_version,
    formula_version,
    methodology_id,
    available_feature_families,
    missing_feature_families,
    source_county_count,
    scored_county_count,
    water_coverage_count
  FROM analytics_meta.county_score_publications
  WHERE status = 'published'
  ORDER BY published_at DESC, run_id DESC
  LIMIT 1
)
SELECT
  publication.run_id AS publication_run_id,
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
  COALESCE(publication.source_county_count, live_counts.live_source_county_count) AS source_county_count,
  publication.scored_county_count,
  publication.water_coverage_count,
  live_counts.score_row_count,
  live_counts.metrics_row_count
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
  live_counts.live_source_county_count,
  NULL::integer,
  NULL::integer,
  live_counts.score_row_count,
  live_counts.metrics_row_count
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

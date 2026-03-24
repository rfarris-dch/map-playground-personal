import { runQuery } from "@/db/postgres";
import type { CountyScoreRow } from "@/geo/county-intelligence/county-intelligence.repo.types";

export interface CountyPowerStoryGeometryRow {
  readonly centroid_lat: number | string | null | undefined;
  readonly centroid_lng: number | string | null | undefined;
  readonly county_fips: string;
  readonly county_name: string | null | undefined;
  readonly geom_json: unknown;
  readonly state_abbrev: string | null | undefined;
}

export interface CountyPowerStoryPublicationRow {
  readonly data_version: string | null | undefined;
  readonly formula_version: string | null | undefined;
  readonly input_data_version: string | null | undefined;
  readonly publication_run_id: string | null | undefined;
  readonly published_at: Date | string | null | undefined;
}

export interface CountyPowerStoryVectorTileRow {
  readonly tile: Uint8Array | null | undefined;
}

const COUNTY_POWER_STORY_GEOMETRY_SQL = `
SELECT
  county.county_fips,
  county.county_name,
  county.state_abbrev,
  ST_AsGeoJSON(county.geom)::jsonb AS geom_json,
  ST_X(ST_PointOnSurface(county.geom))::double precision AS centroid_lng,
  ST_Y(ST_PointOnSurface(county.geom))::double precision AS centroid_lat
FROM serve.boundary_county_geom_lod1 AS county;`;

const COUNTY_POWER_STORY_PUBLICATION_SQL = `
SELECT
  publication.publication_run_id,
  publication.data_version,
  publication.input_data_version,
  publication.formula_version,
  publication.published_at
FROM analytics.fact_publication AS publication
WHERE publication.status = 'published'
  AND publication.publication_run_id = $1
LIMIT 1;`;

const COUNTY_POWER_STORY_SNAPSHOT_BY_PUBLICATION_SQL = `
SELECT
  county.county_geoid AS county_fips,
  county.county_name,
  county.state_abbrev,
  TRUE AS has_county_reference,
  row.publication_run_id IS NOT NULL AS has_county_score,
  row.publication_run_id,
  row.rank_status,
  row.attractiveness_tier,
  row.confidence_badge,
  row.market_pressure_index,
  row.demand_pressure_score,
  row.supply_timeline_score,
  row.grid_friction_score,
  row.policy_constraint_score,
  row.freshness_score,
  row.source_volatility,
  row.last_updated_at,
  row.narrative_summary,
  row.top_drivers_json,
  row.deferred_reason_codes_json,
  row.what_changed_30d_json,
  row.what_changed_60d_json,
  row.what_changed_90d_json,
  row.pillar_value_states_json,
  row.expected_mw_0_24m,
  row.expected_mw_24_60m,
  row.recent_commissioned_mw_24m,
  row.demand_momentum_qoq,
  row.provider_entry_count_12m,
  row.expected_supply_mw_0_36m,
  row.expected_supply_mw_36_60m,
  row.signed_ia_mw,
  row.queue_mw_active,
  row.queue_project_count_active,
  row.median_days_in_queue_active,
  row.past_due_share,
  row.market_withdrawal_prior,
  row.congestion_proxy_score,
  row.planned_upgrade_count,
  row.heatmap_signal_flag,
  row.policy_momentum_score,
  row.moratorium_status,
  row.public_sentiment_score,
  row.policy_event_count,
  row.county_tagged_event_share,
  row.policy_mapping_confidence,
  row.wholesale_operator,
  row.market_structure,
  row.balancing_authority,
  row.load_zone,
  row.weather_zone,
  row.operator_zone_label,
  row.operator_zone_type,
  row.operator_zone_confidence,
  row.operator_weather_zone,
  row.meteo_zone,
  row.retail_choice_status,
  row.competitive_area_type,
  row.transmission_miles_69kv_plus,
  row.transmission_miles_138kv_plus,
  row.transmission_miles_230kv_plus,
  row.transmission_miles_345kv_plus,
  row.transmission_miles_500kv_plus,
  row.transmission_miles_765kv_plus,
  row.gas_pipeline_presence_flag,
  row.gas_pipeline_mileage_county,
  row.fiber_presence_flag,
  row.primary_market_id,
  row.primary_tdu_or_utility,
  row.utility_context_json,
  row.is_seam_county,
  row.queue_storage_mw,
  row.queue_solar_mw,
  row.queue_wind_mw,
  row.queue_avg_age_days,
  row.queue_withdrawal_rate,
  row.recent_online_mw,
  row.avg_rt_congestion_component,
  row.p95_shadow_price,
  row.negative_price_hour_share,
  row.top_constraints_json,
  row.source_provenance_json,
  row.formula_version,
  row.input_data_version
FROM analytics.dim_county AS county
LEFT JOIN analytics.fact_market_analysis_score_snapshot AS row
  ON row.county_geoid = county.county_geoid
  AND row.publication_run_id = $1;`;

const COUNTY_POWER_STORY_VECTOR_TILE_SQL = `
WITH tile AS (
  SELECT
    ST_TileEnvelope($1, $2, $3) AS geom_3857,
    ST_Transform(ST_TileEnvelope($1, $2, $3), 4326) AS geom_4326
)
SELECT
  COALESCE(
    ST_AsMVT(mvt_rows, 'county_power_story', 4096, 'geom'),
    '\\x'::bytea
  ) AS tile
FROM (
  SELECT
    county.county_fips,
    ST_AsMVTGeom(
      ST_Transform(county.geom, 3857),
      tile.geom_3857,
      4096,
      64,
      true
    ) AS geom
  FROM serve.boundary_county_geom_lod1 AS county
  CROSS JOIN tile
  WHERE county.geom && tile.geom_4326
    AND ST_Intersects(county.geom, tile.geom_4326)
) AS mvt_rows;`;

export function listCountyPowerStoryGeometry(): Promise<CountyPowerStoryGeometryRow[]> {
  return runQuery<CountyPowerStoryGeometryRow>(COUNTY_POWER_STORY_GEOMETRY_SQL, []);
}

export async function getCountyPowerStoryPublication(
  publicationRunId: string
): Promise<CountyPowerStoryPublicationRow | null> {
  const rows = await runQuery<CountyPowerStoryPublicationRow>(COUNTY_POWER_STORY_PUBLICATION_SQL, [
    publicationRunId,
  ]);

  return rows[0] ?? null;
}

export function listCountyPowerStorySnapshotRowsByPublication(
  publicationRunId: string
): Promise<CountyScoreRow[]> {
  return runQuery<CountyScoreRow>(COUNTY_POWER_STORY_SNAPSHOT_BY_PUBLICATION_SQL, [
    publicationRunId,
  ]);
}

export async function getCountyPowerStoryVectorTile(args: {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}): Promise<Uint8Array> {
  const rows = await runQuery<CountyPowerStoryVectorTileRow>(COUNTY_POWER_STORY_VECTOR_TILE_SQL, [
    args.z,
    args.x,
    args.y,
  ]);

  return rows[0]?.tile ?? new Uint8Array();
}

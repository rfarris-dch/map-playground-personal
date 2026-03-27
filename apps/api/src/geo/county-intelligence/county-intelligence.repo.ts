import {
  CATCHMENT_DEBUG_REFERENCE_FAMILY,
  CATCHMENT_SPILLOVER_CONFIG_VERSION,
  getCatchmentDebugPointTouchWeight,
} from "@map-migration/core-runtime/catchment-calibration";
import { getCountyMetricsQuerySpec } from "@map-migration/geo-sql";
import { runQuery } from "@/db/postgres";
import type {
  CountyCatchmentDebugRow,
  CountyConfidenceTraceRow,
  CountyCongestionDebugRow,
  CountyOperatorZoneDebugRow,
  CountyQueuePoiReferenceDebugRow,
  CountyQueueResolutionDebugRow,
  CountyScoreRow,
  CountyScoresCoverageByOperatorRow,
  CountyScoresCoverageFieldRow,
  CountyScoresResolutionSourceRow,
  CountyScoresStatusRow,
} from "./county-intelligence.repo.types";

export type {
  CountyCatchmentDebugRow,
  CountyConfidenceTraceRow,
  CountyCongestionDebugRow,
  CountyOperatorZoneDebugRow,
  CountyQueuePoiReferenceDebugRow,
  CountyQueueResolutionDebugRow,
  CountyScoreRow,
  CountyScoresCoverageByOperatorRow,
  CountyScoresCoverageFieldRow,
  CountyScoresResolutionSourceRow,
  CountyScoresStatusRow,
} from "./county-intelligence.repo.types";

const TRAILING_SEMICOLON_PATTERN = /;\s*$/;
const COUNTY_CATCHMENT_POINT_TOUCH_WEIGHT = getCatchmentDebugPointTouchWeight();

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
  county_metrics.evidence_confidence,
  county_metrics.method_confidence,
  county_metrics.coverage_confidence,
  county_metrics.freshness_state,
  county_metrics.suppression_state,
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
  county_metrics.wholesale_operator,
  county_metrics.market_structure,
  county_metrics.balancing_authority,
  county_metrics.load_zone,
  county_metrics.operator_zone_label,
  county_metrics.operator_zone_type,
  county_metrics.operator_zone_confidence,
  county_metrics.weather_zone,
  county_metrics.operator_weather_zone,
  county_metrics.meteo_zone,
  county_metrics.retail_choice_status,
  county_metrics.competitive_area_type,
  county_metrics.transmission_miles_69kv_plus,
  county_metrics.transmission_miles_138kv_plus,
  county_metrics.transmission_miles_230kv_plus,
  county_metrics.transmission_miles_345kv_plus,
  county_metrics.transmission_miles_500kv_plus,
  county_metrics.transmission_miles_765kv_plus,
  county_metrics.gas_pipeline_presence_flag,
  county_metrics.gas_pipeline_mileage_county,
  county_metrics.fiber_presence_flag,
  county_metrics.primary_market_id,
  county_metrics.primary_tdu_or_utility,
  county_metrics.utility_context_json,
  county_metrics.is_border_county,
  county_metrics.is_seam_county,
  county_metrics.queue_storage_mw,
  county_metrics.queue_solar_mw,
  county_metrics.queue_wind_mw,
  county_metrics.queue_avg_age_days,
  county_metrics.queue_withdrawal_rate,
  county_metrics.recent_online_mw,
  county_metrics.avg_rt_congestion_component,
  county_metrics.p95_shadow_price,
  county_metrics.negative_price_hour_share,
  county_metrics.top_constraints_json,
  county_metrics.source_provenance_json,
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

const COUNTY_SCORES_COVERAGE_FIELDS_SQL = `
WITH current_scores AS (
  SELECT *
  FROM analytics.county_market_pressure_current
)
SELECT
  field_coverage.field_name,
  field_coverage.populated_count,
  field_coverage.total_count
FROM (
  SELECT
    'wholesaleOperator'::text AS field_name,
    COUNT(*) FILTER (WHERE NULLIF(BTRIM(wholesale_operator), '') IS NOT NULL)::integer
      AS populated_count,
    COUNT(*)::integer AS total_count
  FROM current_scores
  UNION ALL
  SELECT
    'balancingAuthority'::text,
    COUNT(*) FILTER (WHERE NULLIF(BTRIM(balancing_authority), '') IS NOT NULL)::integer,
    COUNT(*)::integer
  FROM current_scores
  UNION ALL
  SELECT
    'primaryTduOrUtility'::text,
    COUNT(*) FILTER (WHERE NULLIF(BTRIM(primary_tdu_or_utility), '') IS NOT NULL)::integer,
    COUNT(*)::integer
  FROM current_scores
  UNION ALL
  SELECT
    'operatorZoneLabel'::text,
    COUNT(*) FILTER (WHERE NULLIF(BTRIM(operator_zone_label), '') IS NOT NULL)::integer,
    COUNT(*)::integer
  FROM current_scores
  UNION ALL
  SELECT
    'operatorWeatherZone'::text,
    COUNT(*) FILTER (WHERE NULLIF(BTRIM(operator_weather_zone), '') IS NOT NULL)::integer,
    COUNT(*)::integer
  FROM current_scores
  UNION ALL
  SELECT
    'meteoZone'::text,
    COUNT(*) FILTER (WHERE NULLIF(BTRIM(meteo_zone), '') IS NOT NULL)::integer,
    COUNT(*)::integer
  FROM current_scores
  UNION ALL
  SELECT
    'avgRtCongestionComponent'::text,
    COUNT(*) FILTER (WHERE avg_rt_congestion_component IS NOT NULL)::integer,
    COUNT(*)::integer
  FROM current_scores
  UNION ALL
  SELECT
    'p95ShadowPrice'::text,
    COUNT(*) FILTER (WHERE p95_shadow_price IS NOT NULL)::integer,
    COUNT(*)::integer
  FROM current_scores
  UNION ALL
  SELECT
    'queueProjectCountActive'::text,
    COUNT(*) FILTER (WHERE queue_project_count_active IS NOT NULL)::integer,
    COUNT(*)::integer
  FROM current_scores
  UNION ALL
  SELECT
    'queueMwActive'::text,
    COUNT(*) FILTER (WHERE queue_mw_active IS NOT NULL)::integer,
    COUNT(*)::integer
  FROM current_scores
) AS field_coverage
ORDER BY field_coverage.field_name;`;

export function listCountyScoresCoverageFields(): Promise<CountyScoresCoverageFieldRow[]> {
  return runQuery<CountyScoresCoverageFieldRow>(COUNTY_SCORES_COVERAGE_FIELDS_SQL, []);
}

const COUNTY_SCORES_COVERAGE_BY_OPERATOR_SQL = `
SELECT
  COALESCE(NULLIF(BTRIM(wholesale_operator), ''), 'unknown') AS wholesale_operator,
  COUNT(*)::integer AS county_count,
  COUNT(*) FILTER (WHERE NULLIF(BTRIM(operator_zone_label), '') IS NOT NULL)::integer
    AS operator_zone_label_count,
  COUNT(*) FILTER (WHERE NULLIF(BTRIM(operator_weather_zone), '') IS NOT NULL)::integer
    AS operator_weather_zone_count,
  COUNT(*) FILTER (WHERE NULLIF(BTRIM(meteo_zone), '') IS NOT NULL)::integer
    AS meteo_zone_count,
  COUNT(*) FILTER (WHERE avg_rt_congestion_component IS NOT NULL)::integer
    AS avg_rt_congestion_component_count,
  COUNT(*) FILTER (WHERE p95_shadow_price IS NOT NULL)::integer AS p95_shadow_price_count,
  COUNT(*) FILTER (WHERE NULLIF(BTRIM(primary_tdu_or_utility), '') IS NOT NULL)::integer
    AS primary_tdu_or_utility_count
FROM analytics.county_market_pressure_current
GROUP BY COALESCE(NULLIF(BTRIM(wholesale_operator), ''), 'unknown')
ORDER BY COALESCE(NULLIF(BTRIM(wholesale_operator), ''), 'unknown');`;

export function listCountyScoresCoverageByOperator(): Promise<CountyScoresCoverageByOperatorRow[]> {
  return runQuery<CountyScoresCoverageByOperatorRow>(COUNTY_SCORES_COVERAGE_BY_OPERATOR_SQL, []);
}

const COUNTY_SCORES_RESOLUTION_SQL = `
WITH latest_resolution_date AS (
  SELECT MAX(effective_date) AS effective_date
  FROM analytics.fact_gen_queue_county_resolution
),
latest_unresolved_date AS (
  SELECT MAX(effective_date) AS effective_date
  FROM analytics.fact_gen_queue_unresolved
),
latest_snapshot_date AS (
  SELECT MAX(effective_date) AS effective_date
  FROM analytics.fact_gen_queue_snapshot
),
latest_projects AS (
  SELECT *
  FROM analytics.fact_gen_queue_project
),
latest_resolutions AS (
  SELECT resolution.*
  FROM analytics.fact_gen_queue_county_resolution AS resolution
  CROSS JOIN latest_resolution_date
  WHERE resolution.effective_date = latest_resolution_date.effective_date
),
latest_unresolved AS (
  SELECT unresolved.*
  FROM analytics.fact_gen_queue_unresolved AS unresolved
  CROSS JOIN latest_unresolved_date
  WHERE unresolved.effective_date = latest_unresolved_date.effective_date
),
latest_snapshots AS (
  SELECT snapshot.*
  FROM analytics.fact_gen_queue_snapshot AS snapshot
  CROSS JOIN latest_snapshot_date
  WHERE snapshot.effective_date = latest_snapshot_date.effective_date
),
project_totals AS (
  SELECT source_system, COUNT(*)::integer AS total_projects
  FROM latest_projects
  GROUP BY source_system
),
snapshot_totals AS (
  SELECT source_system, COUNT(*)::integer AS total_snapshots
  FROM latest_snapshots
  GROUP BY source_system
),
resolution_totals AS (
  SELECT
    source_system,
    COUNT(*) FILTER (
      WHERE resolver_type = 'manual_override'
    )::integer AS manual_resolution_count,
    COUNT(*) FILTER (
      WHERE resolver_type IN ('explicit_county', 'explicit_multi_county')
    )::integer AS direct_resolution_count,
    COUNT(*) FILTER (
      WHERE resolver_type NOT IN ('manual_override', 'explicit_county', 'explicit_multi_county')
    )::integer AS derived_resolution_count,
    COUNT(*) FILTER (WHERE resolver_confidence = 'low')::integer
      AS low_confidence_resolution_count
  FROM latest_resolutions
  GROUP BY source_system
),
unresolved_projects AS (
  SELECT
    unresolved.source_system,
    COUNT(*)::integer AS unresolved_projects
  FROM latest_unresolved AS unresolved
  GROUP BY unresolved.source_system
),
unresolved_snapshots AS (
  SELECT
    snapshot.source_system,
    COUNT(*)::integer AS unresolved_snapshots
  FROM latest_snapshots AS snapshot
  LEFT JOIN latest_resolutions AS resolution
    ON resolution.project_id = snapshot.project_id
    AND resolution.source_system = snapshot.source_system
  WHERE snapshot.county_geoid IS NULL
    AND resolution.project_id IS NULL
  GROUP BY snapshot.source_system
),
unresolved_project_samples AS (
  SELECT
    unresolved.source_system,
    unresolved.project_id,
    NULLIF(BTRIM(unresolved.queue_poi_label), '') AS queue_poi_label,
    NULLIF(BTRIM(unresolved.raw_location_label), '') AS queue_name,
    ROW_NUMBER() OVER (
      PARTITION BY unresolved.source_system
      ORDER BY unresolved.project_id
    ) AS sample_rank
  FROM latest_unresolved AS unresolved
),
sample_labels AS (
  SELECT
    source_system,
    TO_JSON(
      COALESCE(
        ARRAY_AGG(queue_poi_label) FILTER (
          WHERE sample_rank <= 5
            AND queue_poi_label IS NOT NULL
        ),
        '{}'::text[]
      )
    ) AS sample_poi_labels,
    TO_JSON(
      COALESCE(
        ARRAY_AGG(queue_name) FILTER (
          WHERE sample_rank <= 5
            AND queue_name IS NOT NULL
        ),
        '{}'::text[]
      )
    ) AS sample_location_labels
  FROM unresolved_project_samples
  GROUP BY source_system
),
unresolved_snapshot_samples AS (
  SELECT
    snapshot.source_system,
    snapshot.project_id,
    NULLIF(BTRIM(project.queue_poi_label), '') AS queue_poi_label,
    NULLIF(BTRIM(project.queue_name), '') AS queue_name,
    ROW_NUMBER() OVER (
      PARTITION BY snapshot.source_system
      ORDER BY snapshot.project_id
    ) AS sample_rank
  FROM latest_snapshots AS snapshot
  LEFT JOIN latest_projects AS project
    ON project.project_id = snapshot.project_id
    AND project.source_system = snapshot.source_system
  LEFT JOIN latest_resolutions AS resolution
    ON resolution.project_id = snapshot.project_id
    AND resolution.source_system = snapshot.source_system
  WHERE snapshot.county_geoid IS NULL
    AND resolution.project_id IS NULL
),
sample_snapshot_labels AS (
  SELECT
    source_system,
    TO_JSON(
      COALESCE(
        ARRAY_AGG(queue_poi_label) FILTER (
          WHERE sample_rank <= 5
            AND queue_poi_label IS NOT NULL
        ),
        '{}'::text[]
      )
    ) AS sample_snapshot_poi_labels,
    TO_JSON(
      COALESCE(
        ARRAY_AGG(queue_name) FILTER (
          WHERE sample_rank <= 5
            AND queue_name IS NOT NULL
        ),
        '{}'::text[]
      )
    ) AS sample_snapshot_location_labels
  FROM unresolved_snapshot_samples
  GROUP BY source_system
),
source_systems AS (
  SELECT source_system FROM project_totals
  UNION
  SELECT source_system FROM snapshot_totals
  UNION
  SELECT source_system FROM resolution_totals
  UNION
  SELECT source_system FROM unresolved_projects
  UNION
  SELECT source_system FROM unresolved_snapshots
  UNION
  SELECT source_system FROM latest_unresolved
)
SELECT
  source_systems.source_system,
  COALESCE(project_totals.total_projects, 0) AS total_projects,
  COALESCE(unresolved_projects.unresolved_projects, 0) AS unresolved_projects,
  COALESCE(snapshot_totals.total_snapshots, 0) AS total_snapshots,
  COALESCE(unresolved_snapshots.unresolved_snapshots, 0) AS unresolved_snapshots,
  COALESCE(resolution_totals.direct_resolution_count, 0) AS direct_resolution_count,
  COALESCE(resolution_totals.derived_resolution_count, 0) AS derived_resolution_count,
  COALESCE(resolution_totals.manual_resolution_count, 0) AS manual_resolution_count,
  COALESCE(resolution_totals.low_confidence_resolution_count, 0)
    AS low_confidence_resolution_count,
  COALESCE(sample_labels.sample_poi_labels, '[]'::json) AS sample_poi_labels,
  COALESCE(sample_labels.sample_location_labels, '[]'::json) AS sample_location_labels,
  COALESCE(sample_snapshot_labels.sample_snapshot_poi_labels, '[]'::json)
    AS sample_snapshot_poi_labels,
  COALESCE(sample_snapshot_labels.sample_snapshot_location_labels, '[]'::json)
    AS sample_snapshot_location_labels,
  (SELECT effective_date FROM latest_resolution_date) AS effective_date
FROM source_systems
LEFT JOIN project_totals
  ON project_totals.source_system = source_systems.source_system
LEFT JOIN unresolved_projects
  ON unresolved_projects.source_system = source_systems.source_system
LEFT JOIN snapshot_totals
  ON snapshot_totals.source_system = source_systems.source_system
LEFT JOIN unresolved_snapshots
  ON unresolved_snapshots.source_system = source_systems.source_system
LEFT JOIN resolution_totals
  ON resolution_totals.source_system = source_systems.source_system
LEFT JOIN sample_labels
  ON sample_labels.source_system = source_systems.source_system
LEFT JOIN sample_snapshot_labels
  ON sample_snapshot_labels.source_system = source_systems.source_system
ORDER BY source_systems.source_system;`;

export function listCountyScoresResolutionBySource(): Promise<CountyScoresResolutionSourceRow[]> {
  return runQuery<CountyScoresResolutionSourceRow>(COUNTY_SCORES_RESOLUTION_SQL, []);
}

function countyOperatorZoneDebugSql(countyIdCount: number): string {
  return `
WITH requested_counties (county_fips) AS (
  VALUES ${requestedCountyValues(countyIdCount)}
),
latest_effective_date AS (
  SELECT MAX(effective_date) AS effective_date
  FROM analytics.bridge_county_operator_zone
)
SELECT
  bridge.county_geoid AS county_fips,
  bridge.wholesale_operator,
  bridge.operator_zone_label,
  bridge.operator_zone_type,
  bridge.operator_zone_confidence,
  bridge.resolution_method,
  bridge.allocation_share,
  bridge.source_as_of_date
FROM analytics.bridge_county_operator_zone AS bridge
INNER JOIN requested_counties
  ON requested_counties.county_fips = bridge.county_geoid
CROSS JOIN latest_effective_date
WHERE bridge.effective_date = latest_effective_date.effective_date
ORDER BY bridge.county_geoid, bridge.wholesale_operator, bridge.operator_zone_label;`;
}

export function listCountyOperatorZoneDebug(
  countyIds: readonly string[]
): Promise<CountyOperatorZoneDebugRow[]> {
  return runQuery<CountyOperatorZoneDebugRow>(countyOperatorZoneDebugSql(countyIds.length), [
    ...countyIds,
  ]);
}

function countyQueueResolutionDebugSql(countyIdCount: number): string {
  return `
WITH requested_counties (county_fips) AS (
  VALUES ${requestedCountyValues(countyIdCount)}
),
latest_effective_date AS (
  SELECT MAX(effective_date) AS effective_date
  FROM analytics.fact_gen_queue_county_resolution
)
SELECT
  resolution.county_geoid AS county_fips,
  resolution.project_id,
  resolution.source_system,
  resolution.state_abbrev,
  resolution.allocation_share,
  resolution.resolver_type,
  resolution.resolver_confidence,
  resolution.source_location_label,
  resolution.queue_poi_label
FROM analytics.fact_gen_queue_county_resolution AS resolution
INNER JOIN requested_counties
  ON requested_counties.county_fips = resolution.county_geoid
CROSS JOIN latest_effective_date
WHERE resolution.effective_date = latest_effective_date.effective_date
ORDER BY resolution.county_geoid, resolution.source_system, resolution.project_id;`;
}

export function listCountyQueueResolutionDebug(
  countyIds: readonly string[]
): Promise<CountyQueueResolutionDebugRow[]> {
  return runQuery<CountyQueueResolutionDebugRow>(countyQueueResolutionDebugSql(countyIds.length), [
    ...countyIds,
  ]);
}

function countyQueuePoiReferenceDebugSql(countyIdCount: number): string {
  return `
WITH requested_counties (county_fips) AS (
  VALUES ${requestedCountyValues(countyIdCount)}
),
latest_effective_date AS (
  SELECT MAX(effective_date) AS effective_date
  FROM analytics.dim_queue_poi_reference
)
SELECT
  reference.county_geoid AS county_fips,
  reference.source_system,
  reference.queue_poi_label,
  reference.state_abbrev,
  reference.operator_zone_label,
  reference.operator_zone_type,
  reference.resolution_method,
  reference.resolver_confidence,
  reference.source_as_of_date
FROM analytics.dim_queue_poi_reference AS reference
INNER JOIN requested_counties
  ON requested_counties.county_fips = reference.county_geoid
CROSS JOIN latest_effective_date
WHERE reference.effective_date = latest_effective_date.effective_date
ORDER BY reference.county_geoid, reference.source_system, reference.queue_poi_label;`;
}

export function listCountyQueuePoiReferenceDebug(
  countyIds: readonly string[]
): Promise<CountyQueuePoiReferenceDebugRow[]> {
  return runQuery<CountyQueuePoiReferenceDebugRow>(
    countyQueuePoiReferenceDebugSql(countyIds.length),
    [...countyIds]
  );
}

function countyCongestionDebugSql(countyIdCount: number): string {
  return `
WITH requested_counties (county_fips) AS (
  VALUES ${requestedCountyValues(countyIdCount)}
),
latest_month AS (
  SELECT MAX(month) AS month
  FROM analytics.fact_congestion_snapshot
)
SELECT
  congestion.county_geoid AS county_fips,
  congestion.avg_rt_congestion_component,
  congestion.p95_shadow_price,
  congestion.negative_price_hour_share,
  congestion.source_as_of_date
FROM analytics.fact_congestion_snapshot AS congestion
INNER JOIN requested_counties
  ON requested_counties.county_fips = congestion.county_geoid
CROSS JOIN latest_month
WHERE congestion.month = latest_month.month
ORDER BY congestion.county_geoid;`;
}

export function listCountyCongestionDebug(
  countyIds: readonly string[]
): Promise<CountyCongestionDebugRow[]> {
  return runQuery<CountyCongestionDebugRow>(countyCongestionDebugSql(countyIds.length), [
    ...countyIds,
  ]);
}

function countyCatchmentDebugSql(countyIdCount: number): string {
  return `
WITH requested_counties (county_fips) AS (
  VALUES ${requestedCountyValues(countyIdCount)}
),
adjacency_source AS (
  SELECT
    active_sources.source_id AS adjacency_source_id,
    active_sources.current_source_version_id AS adjacency_source_version_id
  FROM registry.active_sources AS active_sources
  WHERE active_sources.source_id = 'census-county-adjacency-2025'
  ORDER BY active_sources.registry_version DESC
  LIMIT 1
),
catchment_stats AS (
  SELECT
    adjacency.county_geoid AS county_fips,
    COUNT(*)::integer AS neighbor_count,
    COUNT(*) FILTER (WHERE NOT adjacency.point_touch)::integer AS shared_edge_neighbor_count,
    COUNT(*) FILTER (WHERE adjacency.point_touch)::integer AS point_touch_neighbor_count,
    SUM(
      CASE
        WHEN adjacency.point_touch THEN ${String(COUNTY_CATCHMENT_POINT_TOUCH_WEIGHT)}::numeric
        ELSE 1::numeric
      END
    ) AS total_weight_mass,
    CASE
      WHEN SUM(
        CASE
          WHEN adjacency.point_touch THEN ${String(COUNTY_CATCHMENT_POINT_TOUCH_WEIGHT)}::numeric
          ELSE 1::numeric
        END
      ) > 0
        THEN SUM(
          CASE
            WHEN adjacency.point_touch THEN ${String(COUNTY_CATCHMENT_POINT_TOUCH_WEIGHT)}::numeric
            ELSE 0::numeric
          END
        ) / SUM(
          CASE
            WHEN adjacency.point_touch THEN ${String(COUNTY_CATCHMENT_POINT_TOUCH_WEIGHT)}::numeric
            ELSE 1::numeric
          END
        )
      ELSE NULL::numeric
    END AS point_touch_weight_share
  FROM analytics.bridge_county_adjacency AS adjacency
  INNER JOIN requested_counties
    ON requested_counties.county_fips = adjacency.county_geoid
  GROUP BY adjacency.county_geoid
)
SELECT
  requested_counties.county_fips,
  '${CATCHMENT_SPILLOVER_CONFIG_VERSION}'::text AS calibration_version,
  COALESCE(adjacency_source.adjacency_source_id, 'census-county-adjacency-2025')
    AS adjacency_source_id,
  adjacency_source.adjacency_source_version_id,
  '${CATCHMENT_DEBUG_REFERENCE_FAMILY}'::text AS point_touch_reference_family,
  COALESCE(catchment_stats.neighbor_count, 0)::integer AS neighbor_count,
  COALESCE(catchment_stats.shared_edge_neighbor_count, 0)::integer AS shared_edge_neighbor_count,
  COALESCE(catchment_stats.point_touch_neighbor_count, 0)::integer AS point_touch_neighbor_count,
  catchment_stats.total_weight_mass,
  catchment_stats.point_touch_weight_share
FROM requested_counties
LEFT JOIN catchment_stats
  ON catchment_stats.county_fips = requested_counties.county_fips
LEFT JOIN adjacency_source
  ON TRUE
ORDER BY requested_counties.county_fips;`;
}

export function listCountyCatchmentDebug(
  countyIds: readonly string[]
): Promise<CountyCatchmentDebugRow[]> {
  return runQuery<CountyCatchmentDebugRow>(countyCatchmentDebugSql(countyIds.length), [
    ...countyIds,
  ]);
}

const COUNTY_CONFIDENCE_TRACE_SQL = `
SELECT
  confidence_trace.registry_version,
  confidence_trace.downstream_object_type,
  confidence_trace.downstream_object_id,
  confidence_trace.minimum_constitutive_confidence_cap,
  confidence_trace.minimum_truth_mode_cap,
  confidence_trace.worst_required_freshness_state,
  confidence_trace.baseline_suppression_state,
  confidence_trace.dependencies_json
FROM analytics.v_downstream_confidence_trace_current AS confidence_trace
WHERE confidence_trace.downstream_object_type = 'score'
  AND confidence_trace.downstream_object_id = 'county_market_pressure_primary'
LIMIT 1;`;

export async function getCountyConfidenceTrace(): Promise<CountyConfidenceTraceRow | null> {
  const rows = await runQuery<CountyConfidenceTraceRow>(COUNTY_CONFIDENCE_TRACE_SQL, []);
  return rows[0] ?? null;
}

const COUNTY_CATCHMENT_TRACE_SQL = `
SELECT
  confidence_trace.registry_version,
  confidence_trace.downstream_object_type,
  confidence_trace.downstream_object_id,
  confidence_trace.minimum_constitutive_confidence_cap,
  confidence_trace.minimum_truth_mode_cap,
  confidence_trace.worst_required_freshness_state,
  confidence_trace.baseline_suppression_state,
  confidence_trace.dependencies_json
FROM analytics.v_downstream_confidence_trace_current AS confidence_trace
WHERE confidence_trace.downstream_object_type = 'score'
  AND confidence_trace.downstream_object_id = 'county_market_pressure_catchment'
LIMIT 1;`;

export async function getCountyCatchmentConfidenceTrace(): Promise<CountyConfidenceTraceRow | null> {
  const rows = await runQuery<CountyConfidenceTraceRow>(COUNTY_CATCHMENT_TRACE_SQL, []);
  return rows[0] ?? null;
}

const COUNTY_SCORES_STATUS_SQL = `
WITH live_counts AS (
  SELECT
    (SELECT COUNT(*)::integer FROM analytics.county_market_pressure_current) AS row_count,
    (SELECT COUNT(*)::integer FROM analytics.dim_county) AS source_county_count
),
latest_reproducibility AS (
  SELECT *
  FROM analytics_meta.v_run_reproducibility_summary
  WHERE surface_scope = 'county'
    AND run_kind = 'publication'
),
latest_publication AS (
  SELECT
    publication_run_id,
    status,
    published_at,
    data_version,
    input_data_version,
    registry_version,
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
    fresh_county_count,
    freshness_fresh_count,
    freshness_aging_count,
    freshness_stale_count,
    freshness_critical_count,
    freshness_unknown_count,
    suppression_none_count,
    suppression_downgraded_count,
    suppression_review_required_count,
    suppression_suppressed_count
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
  publication.registry_version,
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
  publication.fresh_county_count,
  publication.freshness_fresh_count,
  publication.freshness_aging_count,
  publication.freshness_stale_count,
  publication.freshness_critical_count,
  publication.freshness_unknown_count,
  publication.suppression_none_count,
  publication.suppression_downgraded_count,
  publication.suppression_review_required_count,
  publication.suppression_suppressed_count,
  (reproducibility.run_id IS NOT NULL) AS reproducibility_available,
  reproducibility.replayability_tier,
  reproducibility.config_hash,
  reproducibility.envelope_hash,
  reproducibility.source_version_count,
  reproducibility.ingestion_snapshot_count,
  reproducibility.replayed_from_run_id
FROM latest_publication AS publication
CROSS JOIN live_counts
LEFT JOIN latest_reproducibility AS reproducibility
  ON reproducibility.run_id = publication.publication_run_id
UNION ALL
SELECT
  NULL::text,
  NULL::text,
  NULL::timestamptz,
  NULL::text,
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
  0::integer,
  0::integer,
  0::integer,
  0::integer,
  0::integer,
  0::integer,
  0::integer,
  0::integer,
  0::integer,
  0::integer,
  FALSE,
  NULL::text,
  NULL::text,
  NULL::text,
  0::integer,
  0::integer,
  NULL::text
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

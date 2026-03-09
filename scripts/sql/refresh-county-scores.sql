BEGIN;

DO $$
BEGIN
  IF to_regclass('serve.boundary_county_geom_lod1') IS NULL THEN
    RAISE EXCEPTION 'missing county boundary source: serve.boundary_county_geom_lod1';
  END IF;
END $$;

TRUNCATE TABLE analytics.county_market_pressure_current;
TRUNCATE TABLE analytics.bridge_county_adjacency;
TRUNCATE TABLE analytics.bridge_county_market;
TRUNCATE TABLE analytics.dim_county;

INSERT INTO analytics.dim_county (
  county_geoid,
  county_name,
  state_abbrev,
  geom,
  geom_3857,
  centroid,
  centroid_3857,
  area_sqkm,
  source_pull_ts,
  source_as_of_date,
  effective_date,
  model_version
)
SELECT
  county.county_fips,
  county.county_name,
  county.state_abbrev,
  county.geom,
  county.geom_3857,
  ST_PointOnSurface(county.geom) AS centroid,
  ST_PointOnSurface(county.geom_3857) AS centroid_3857,
  county.area_sqkm,
  now(),
  :'data_version'::date,
  :'data_version'::date,
  :'formula_version'::text
FROM serve.boundary_county_geom_lod1 AS county;

WITH adjacency_pairs AS (
  SELECT
    county.county_geoid,
    adjacent.county_geoid AS adjacent_county_geoid,
    ROUND(
      COALESCE(
        ST_Length(
          ST_CollectionExtract(
            ST_Intersection(county.geom_3857, adjacent.geom_3857),
            2
          )
        ),
        0
      )::numeric,
      2
    ) AS shared_boundary_meters,
    COALESCE(
      ST_Dimension(ST_Intersection(county.geom, adjacent.geom)) = 0,
      false
    ) AS point_touch
  FROM analytics.dim_county AS county
  INNER JOIN analytics.dim_county AS adjacent
    ON county.county_geoid < adjacent.county_geoid
   AND ST_Touches(county.geom, adjacent.geom)
)
INSERT INTO analytics.bridge_county_adjacency (
  county_geoid,
  adjacent_county_geoid,
  shared_boundary_meters,
  point_touch,
  source_pull_ts,
  source_as_of_date,
  effective_date,
  model_version
)
SELECT
  pair.county_geoid,
  pair.adjacent_county_geoid,
  pair.shared_boundary_meters,
  pair.point_touch,
  now(),
  :'data_version'::date,
  :'data_version'::date,
  :'formula_version'::text
FROM adjacency_pairs AS pair
UNION ALL
SELECT
  pair.adjacent_county_geoid,
  pair.county_geoid,
  pair.shared_boundary_meters,
  pair.point_touch,
  now(),
  :'data_version'::date,
  :'data_version'::date,
  :'formula_version'::text
FROM adjacency_pairs AS pair;

CREATE TEMP TABLE market_overlap_stage (
  county_geoid text NOT NULL,
  market_id text NOT NULL,
  county_overlap_pct numeric(8, 6) NOT NULL,
  market_overlap_pct numeric(8, 6) NOT NULL
) ON COMMIT DROP;

DO $$
BEGIN
  IF to_regclass('market_current.market_boundaries') IS NOT NULL THEN
    EXECUTE $sql$
      INSERT INTO market_overlap_stage (
        county_geoid,
        market_id,
        county_overlap_pct,
        market_overlap_pct
      )
      WITH county_market_intersections AS (
        SELECT
          county.county_geoid,
          market.market_id,
          ST_Area(
            ST_Intersection(
              county.geom_3857,
              ST_Transform(market.geom, 3857)
            )
          ) AS overlap_area_m2,
          ST_Area(county.geom_3857) AS county_area_m2,
          ST_Area(ST_Transform(market.geom, 3857)) AS market_area_m2
        FROM analytics.dim_county AS county
        INNER JOIN market_current.market_boundaries AS market
          ON ST_Intersects(county.geom, market.geom)
      )
      SELECT
        intersection.county_geoid,
        intersection.market_id,
        ROUND(
          CASE
            WHEN intersection.county_area_m2 > 0
              THEN (intersection.overlap_area_m2 / intersection.county_area_m2)::numeric
            ELSE 0::numeric
          END,
          6
        ) AS county_overlap_pct,
        ROUND(
          CASE
            WHEN intersection.market_area_m2 > 0
              THEN (intersection.overlap_area_m2 / intersection.market_area_m2)::numeric
            ELSE 0::numeric
          END,
          6
        ) AS market_overlap_pct
      FROM county_market_intersections AS intersection
      WHERE intersection.overlap_area_m2 > 0;
    $sql$;
  END IF;
END $$;

WITH seam_flags AS (
  SELECT
    stage.county_geoid,
    COUNT(*) > 1 AS is_seam_county
  FROM market_overlap_stage AS stage
  GROUP BY stage.county_geoid
),
ranked_markets AS (
  SELECT
    stage.county_geoid,
    stage.market_id,
    stage.county_overlap_pct,
    stage.market_overlap_pct,
    ROW_NUMBER() OVER (
      PARTITION BY stage.county_geoid
      ORDER BY stage.county_overlap_pct DESC, stage.market_overlap_pct DESC, stage.market_id ASC
    ) AS overlap_rank
  FROM market_overlap_stage AS stage
)
INSERT INTO analytics.bridge_county_market (
  county_geoid,
  market_id,
  county_overlap_pct,
  market_overlap_pct,
  is_primary_market,
  is_seam_county,
  source_pull_ts,
  source_as_of_date,
  effective_date,
  model_version
)
SELECT
  market.county_geoid,
  market.market_id,
  market.county_overlap_pct,
  market.market_overlap_pct,
  market.overlap_rank = 1,
  COALESCE(seam.is_seam_county, false),
  now(),
  :'data_version'::date,
  :'data_version'::date,
  :'formula_version'::text
FROM ranked_markets AS market
LEFT JOIN seam_flags AS seam
  ON seam.county_geoid = market.county_geoid;

CREATE TEMP TABLE current_dc_pipeline_source ON COMMIT DROP AS
SELECT
  facility.facility_id AS project_id,
  'hawk.export.arcgis-colo'::text AS source_system,
  'colocation'::text AS project_type,
  facility.provider_id,
  COALESCE(NULLIF(facility.provider_slug, ''), facility.provider_id, facility.facility_name) AS provider_label,
  facility.facility_name AS project_name,
  facility.county_fips AS county_geoid,
  facility.state_abbrev,
  facility.commissioned_semantic,
  COALESCE(facility.commissioned_power_mw, 0)::numeric(12, 2) AS commissioned_power_mw,
  COALESCE(facility.planned_power_mw, 0)::numeric(12, 2) AS planned_power_mw,
  COALESCE(facility.under_construction_power_mw, 0)::numeric(12, 2) AS under_construction_power_mw,
  COALESCE(facility.available_power_mw, 0)::numeric(12, 2) AS available_power_mw,
  COALESCE(facility.freshness_ts, now()) AS source_pull_ts,
  COALESCE(facility.source_dataset_date, :'data_version'::date) AS source_as_of_date
FROM serve.facility_site AS facility
UNION ALL
SELECT
  hyperscale.hyperscale_id AS project_id,
  'hawk.export.arcgis-hyperscale'::text AS source_system,
  'hyperscale'::text AS project_type,
  hyperscale.provider_id,
  COALESCE(NULLIF(hyperscale.provider_slug, ''), hyperscale.provider_id, hyperscale.facility_name) AS provider_label,
  hyperscale.facility_name AS project_name,
  hyperscale.county_fips AS county_geoid,
  hyperscale.state_abbrev,
  hyperscale.commissioned_semantic,
  COALESCE(hyperscale.commissioned_power_mw, 0)::numeric(12, 2) AS commissioned_power_mw,
  COALESCE(hyperscale.planned_power_mw, 0)::numeric(12, 2) AS planned_power_mw,
  COALESCE(hyperscale.under_construction_power_mw, 0)::numeric(12, 2) AS under_construction_power_mw,
  NULL::numeric(12, 2) AS available_power_mw,
  COALESCE(hyperscale.freshness_ts, now()) AS source_pull_ts,
  COALESCE(hyperscale.source_dataset_date, :'data_version'::date) AS source_as_of_date
FROM serve.hyperscale_site AS hyperscale;

INSERT INTO analytics.fact_dc_pipeline_project (
  project_id,
  source_system,
  project_type,
  provider_id,
  provider_label,
  project_name,
  county_geoid,
  state_abbrev,
  first_seen_at,
  latest_source_as_of_date,
  latest_source_pull_ts,
  model_version
)
SELECT
  source.project_id,
  source.source_system,
  source.project_type,
  source.provider_id,
  source.provider_label,
  source.project_name,
  source.county_geoid,
  source.state_abbrev,
  now(),
  source.source_as_of_date,
  source.source_pull_ts,
  :'formula_version'::text
FROM current_dc_pipeline_source AS source
ON CONFLICT (project_id) DO UPDATE
SET
  source_system = EXCLUDED.source_system,
  project_type = EXCLUDED.project_type,
  provider_id = EXCLUDED.provider_id,
  provider_label = EXCLUDED.provider_label,
  project_name = EXCLUDED.project_name,
  county_geoid = EXCLUDED.county_geoid,
  state_abbrev = EXCLUDED.state_abbrev,
  latest_source_as_of_date = EXCLUDED.latest_source_as_of_date,
  latest_source_pull_ts = EXCLUDED.latest_source_pull_ts,
  model_version = EXCLUDED.model_version;

INSERT INTO analytics.fact_dc_pipeline_snapshot (
  publication_run_id,
  project_id,
  source_system,
  project_type,
  provider_id,
  provider_label,
  project_name,
  county_geoid,
  state_abbrev,
  commissioned_semantic,
  commissioned_power_mw,
  planned_power_mw,
  under_construction_power_mw,
  available_power_mw,
  source_pull_ts,
  source_as_of_date,
  effective_date,
  model_version
)
SELECT
  :'run_id'::text,
  source.project_id,
  source.source_system,
  source.project_type,
  source.provider_id,
  source.provider_label,
  source.project_name,
  source.county_geoid,
  source.state_abbrev,
  source.commissioned_semantic,
  source.commissioned_power_mw,
  source.planned_power_mw,
  source.under_construction_power_mw,
  source.available_power_mw,
  source.source_pull_ts,
  source.source_as_of_date,
  :'data_version'::date,
  :'formula_version'::text
FROM current_dc_pipeline_source AS source
ON CONFLICT (publication_run_id, project_id) DO UPDATE
SET
  source_system = EXCLUDED.source_system,
  project_type = EXCLUDED.project_type,
  provider_id = EXCLUDED.provider_id,
  provider_label = EXCLUDED.provider_label,
  project_name = EXCLUDED.project_name,
  county_geoid = EXCLUDED.county_geoid,
  state_abbrev = EXCLUDED.state_abbrev,
  commissioned_semantic = EXCLUDED.commissioned_semantic,
  commissioned_power_mw = EXCLUDED.commissioned_power_mw,
  planned_power_mw = EXCLUDED.planned_power_mw,
  under_construction_power_mw = EXCLUDED.under_construction_power_mw,
  available_power_mw = EXCLUDED.available_power_mw,
  source_pull_ts = EXCLUDED.source_pull_ts,
  source_as_of_date = EXCLUDED.source_as_of_date,
  effective_date = EXCLUDED.effective_date,
  model_version = EXCLUDED.model_version;

CREATE TEMP TABLE county_market_pressure_stage ON COMMIT DROP AS
WITH runtime AS (
  SELECT
    :'data_version'::date AS data_version,
    :'formula_version'::text AS formula_version,
    :'methodology_id'::text AS methodology_id,
    date_trunc('month', :'data_version'::date)::date AS analysis_month
),
prior_runs AS (
  SELECT
    (
      SELECT snapshot.publication_run_id
      FROM analytics.fact_dc_pipeline_snapshot AS snapshot
      CROSS JOIN runtime
      WHERE snapshot.effective_date <= runtime.data_version - INTERVAL '30 days'
      GROUP BY snapshot.publication_run_id, snapshot.effective_date
      ORDER BY snapshot.effective_date DESC, snapshot.publication_run_id DESC
      LIMIT 1
    ) AS run_30d,
    (
      SELECT snapshot.publication_run_id
      FROM analytics.fact_dc_pipeline_snapshot AS snapshot
      CROSS JOIN runtime
      WHERE snapshot.effective_date <= runtime.data_version - INTERVAL '60 days'
      GROUP BY snapshot.publication_run_id, snapshot.effective_date
      ORDER BY snapshot.effective_date DESC, snapshot.publication_run_id DESC
      LIMIT 1
    ) AS run_60d,
    (
      SELECT snapshot.publication_run_id
      FROM analytics.fact_dc_pipeline_snapshot AS snapshot
      CROSS JOIN runtime
      WHERE snapshot.effective_date <= runtime.data_version - INTERVAL '90 days'
      GROUP BY snapshot.publication_run_id, snapshot.effective_date
      ORDER BY snapshot.effective_date DESC, snapshot.publication_run_id DESC
      LIMIT 1
    ) AS run_90d,
    (
      SELECT snapshot.publication_run_id
      FROM analytics.fact_dc_pipeline_snapshot AS snapshot
      CROSS JOIN runtime
      WHERE snapshot.effective_date <= runtime.data_version - INTERVAL '12 months'
      GROUP BY snapshot.publication_run_id, snapshot.effective_date
      ORDER BY snapshot.effective_date DESC, snapshot.publication_run_id DESC
      LIMIT 1
    ) AS run_12m
),
demand_current AS (
  SELECT
    county.county_geoid,
    ROUND(
      COALESCE(
        SUM(source.under_construction_power_mw + source.planned_power_mw * 0.65),
        0
      )::numeric,
      2
    ) AS expected_mw_0_24m,
    ROUND(COALESCE(SUM(source.planned_power_mw * 0.35), 0)::numeric, 2) AS expected_mw_24_60m,
    ROUND(
      COALESCE(
        SUM(source.commissioned_power_mw) FILTER (
          WHERE source.source_as_of_date >= (SELECT data_version - INTERVAL '24 months' FROM runtime)
        ),
        0
      )::numeric,
      2
    ) AS recent_commissioned_mw_24m,
    ROUND(
      COALESCE(
        SUM(source.planned_power_mw + source.under_construction_power_mw) FILTER (
          WHERE source.source_as_of_date <= (SELECT data_version - INTERVAL '24 months' FROM runtime)
            AND source.commissioned_semantic IN ('planned', 'under_construction')
        ),
        0
      )::numeric,
      2
    ) AS stalled_pipeline_mw,
    COUNT(*) FILTER (
      WHERE source.source_as_of_date <= (SELECT data_version - INTERVAL '24 months' FROM runtime)
        AND source.commissioned_semantic IN ('planned', 'under_construction')
    )::integer AS stalled_facility_count,
    MAX(source.source_pull_ts) AS latest_source_pull_ts,
    MAX(source.source_as_of_date) AS latest_source_as_of_date
  FROM analytics.dim_county AS county
  LEFT JOIN current_dc_pipeline_source AS source
    ON source.county_geoid = county.county_geoid
  GROUP BY county.county_geoid
),
provider_presence_current AS (
  SELECT DISTINCT
    source.county_geoid,
    source.provider_label
  FROM current_dc_pipeline_source AS source
  WHERE source.county_geoid IS NOT NULL
    AND source.provider_label IS NOT NULL
),
provider_presence_12m AS (
  SELECT DISTINCT
    snapshot.county_geoid,
    snapshot.provider_label
  FROM analytics.fact_dc_pipeline_snapshot AS snapshot
  CROSS JOIN prior_runs
  WHERE snapshot.publication_run_id = prior_runs.run_12m
    AND snapshot.county_geoid IS NOT NULL
    AND snapshot.provider_label IS NOT NULL
),
provider_entries_12m AS (
  SELECT
    county.county_geoid,
    CASE
      WHEN (SELECT run_12m FROM prior_runs) IS NULL THEN NULL::integer
      ELSE COUNT(*) FILTER (WHERE historical.provider_label IS NULL)::integer
    END AS provider_entry_count_12m
  FROM analytics.dim_county AS county
  LEFT JOIN provider_presence_current AS current_provider
    ON current_provider.county_geoid = county.county_geoid
  LEFT JOIN provider_presence_12m AS historical
    ON historical.county_geoid = current_provider.county_geoid
   AND historical.provider_label = current_provider.provider_label
  GROUP BY county.county_geoid
),
demand_30d AS (
  SELECT
    snapshot.county_geoid,
    ROUND(
      COALESCE(
        SUM(snapshot.under_construction_power_mw + snapshot.planned_power_mw * 0.65),
        0
      )::numeric,
      2
    ) AS expected_mw_0_24m
  FROM analytics.fact_dc_pipeline_snapshot AS snapshot
  CROSS JOIN prior_runs
  WHERE snapshot.publication_run_id = prior_runs.run_30d
  GROUP BY snapshot.county_geoid
),
demand_60d AS (
  SELECT
    snapshot.county_geoid,
    ROUND(
      COALESCE(
        SUM(snapshot.under_construction_power_mw + snapshot.planned_power_mw * 0.65),
        0
      )::numeric,
      2
    ) AS expected_mw_0_24m
  FROM analytics.fact_dc_pipeline_snapshot AS snapshot
  CROSS JOIN prior_runs
  WHERE snapshot.publication_run_id = prior_runs.run_60d
  GROUP BY snapshot.county_geoid
),
demand_90d AS (
  SELECT
    snapshot.county_geoid,
    ROUND(
      COALESCE(
        SUM(snapshot.under_construction_power_mw + snapshot.planned_power_mw * 0.65),
        0
      )::numeric,
      2
    ) AS expected_mw_0_24m
  FROM analytics.fact_dc_pipeline_snapshot AS snapshot
  CROSS JOIN prior_runs
  WHERE snapshot.publication_run_id = prior_runs.run_90d
  GROUP BY snapshot.county_geoid
),
demand_history AS (
  SELECT
    current_demand.county_geoid,
    CASE
      WHEN demand_90d.expected_mw_0_24m IS NULL OR demand_90d.expected_mw_0_24m = 0
        THEN NULL::numeric
      ELSE ROUND(
        (
          (current_demand.expected_mw_0_24m - demand_90d.expected_mw_0_24m) /
          demand_90d.expected_mw_0_24m
        )::numeric,
        4
      )
    END AS demand_momentum_qoq,
    CASE
      WHEN demand_30d.expected_mw_0_24m IS NULL THEN '[]'::jsonb
      WHEN ABS(current_demand.expected_mw_0_24m - demand_30d.expected_mw_0_24m) < 0.01 THEN '[]'::jsonb
      ELSE jsonb_build_array(
        jsonb_build_object(
          'code',
          'DEMAND_0_24M',
          'direction',
          CASE
            WHEN current_demand.expected_mw_0_24m > demand_30d.expected_mw_0_24m THEN 'up'
            ELSE 'down'
          END,
          'label',
          'Near-term demand pipeline',
          'magnitude',
          ROUND((current_demand.expected_mw_0_24m - demand_30d.expected_mw_0_24m)::numeric, 2),
          'summary',
          'Stage-weighted 0-24 month load pipeline changed over the last 30 days.'
        )
      )
    END AS what_changed_30d_json,
    CASE
      WHEN demand_60d.expected_mw_0_24m IS NULL THEN '[]'::jsonb
      WHEN ABS(current_demand.expected_mw_0_24m - demand_60d.expected_mw_0_24m) < 0.01 THEN '[]'::jsonb
      ELSE jsonb_build_array(
        jsonb_build_object(
          'code',
          'DEMAND_0_24M',
          'direction',
          CASE
            WHEN current_demand.expected_mw_0_24m > demand_60d.expected_mw_0_24m THEN 'up'
            ELSE 'down'
          END,
          'label',
          'Near-term demand pipeline',
          'magnitude',
          ROUND((current_demand.expected_mw_0_24m - demand_60d.expected_mw_0_24m)::numeric, 2),
          'summary',
          'Stage-weighted 0-24 month load pipeline changed over the last 60 days.'
        )
      )
    END AS what_changed_60d_json,
    CASE
      WHEN demand_90d.expected_mw_0_24m IS NULL THEN '[]'::jsonb
      WHEN ABS(current_demand.expected_mw_0_24m - demand_90d.expected_mw_0_24m) < 0.01 THEN '[]'::jsonb
      ELSE jsonb_build_array(
        jsonb_build_object(
          'code',
          'DEMAND_0_24M',
          'direction',
          CASE
            WHEN current_demand.expected_mw_0_24m > demand_90d.expected_mw_0_24m THEN 'up'
            ELSE 'down'
          END,
          'label',
          'Near-term demand pipeline',
          'magnitude',
          ROUND((current_demand.expected_mw_0_24m - demand_90d.expected_mw_0_24m)::numeric, 2),
          'summary',
          'Stage-weighted 0-24 month load pipeline changed over the last 90 days.'
        )
      )
    END AS what_changed_90d_json
  FROM demand_current AS current_demand
  LEFT JOIN demand_30d
    ON demand_30d.county_geoid = current_demand.county_geoid
  LEFT JOIN demand_60d
    ON demand_60d.county_geoid = current_demand.county_geoid
  LEFT JOIN demand_90d
    ON demand_90d.county_geoid = current_demand.county_geoid
),
latest_queue_effective AS (
  SELECT MAX(snapshot.effective_date) AS effective_date
  FROM analytics.fact_gen_queue_snapshot AS snapshot
  CROSS JOIN runtime
  WHERE snapshot.effective_date <= runtime.data_version
),
queue_current AS (
  SELECT
    county.county_geoid,
    ROUND(
      COALESCE(
        SUM(snapshot.capacity_mw * COALESCE(snapshot.completion_prior, 0.25)) FILTER (
          WHERE snapshot.expected_operation_date < (SELECT data_version + INTERVAL '36 months' FROM runtime)
        ),
        0
      )::numeric,
      2
    ) AS expected_supply_mw_0_36m,
    ROUND(
      COALESCE(
        SUM(snapshot.capacity_mw * COALESCE(snapshot.completion_prior, 0.25)) FILTER (
          WHERE snapshot.expected_operation_date >= (SELECT data_version + INTERVAL '36 months' FROM runtime)
            AND snapshot.expected_operation_date < (SELECT data_version + INTERVAL '60 months' FROM runtime)
        ),
        0
      )::numeric,
      2
    ) AS expected_supply_mw_36_60m,
    ROUND(
      COALESCE(SUM(snapshot.capacity_mw) FILTER (WHERE snapshot.signed_ia), 0)::numeric,
      2
    ) AS signed_ia_mw,
    ROUND(
      COALESCE(
        SUM(snapshot.capacity_mw) FILTER (
          WHERE COALESCE(lower(snapshot.queue_status), '') NOT IN ('withdrawn', 'cancelled', 'complete')
        ),
        0
      )::numeric,
      2
    ) AS queue_mw_active,
    COUNT(*) FILTER (
      WHERE COALESCE(lower(snapshot.queue_status), '') NOT IN ('withdrawn', 'cancelled', 'complete')
    )::integer AS queue_project_count_active,
    ROUND(
      percentile_cont(0.5) WITHIN GROUP (
        ORDER BY COALESCE(snapshot.days_in_queue_active, 0)
      )::numeric,
      2
    ) AS median_days_in_queue_active,
    ROUND(
      AVG(CASE WHEN snapshot.is_past_due THEN 1::numeric ELSE 0::numeric END)::numeric,
      6
    ) AS past_due_share,
    ROUND(AVG(snapshot.withdrawal_prior)::numeric, 6) AS market_withdrawal_prior,
    COALESCE(SUM(snapshot.transmission_upgrade_count), 0)::integer AS planned_upgrade_count,
    MAX(snapshot.source_pull_ts) AS latest_source_pull_ts,
    MAX(snapshot.source_as_of_date) AS latest_source_as_of_date
  FROM analytics.dim_county AS county
  LEFT JOIN analytics.fact_gen_queue_snapshot AS snapshot
    ON snapshot.county_geoid = county.county_geoid
   AND snapshot.effective_date = (SELECT effective_date FROM latest_queue_effective)
  GROUP BY county.county_geoid
),
latest_generation_effective AS (
  SELECT MAX(snapshot.effective_date) AS effective_date
  FROM analytics.fact_generation_realized_snapshot AS snapshot
  CROSS JOIN runtime
  WHERE snapshot.effective_date <= runtime.data_version
),
generation_current AS (
  SELECT
    snapshot.county_geoid,
    ROUND(COALESCE(SUM(snapshot.operable_mw), 0)::numeric, 2) AS operable_mw,
    ROUND(COALESCE(SUM(snapshot.proposed_mw), 0)::numeric, 2) AS proposed_mw,
    MAX(snapshot.source_pull_ts) AS latest_source_pull_ts,
    MAX(snapshot.source_as_of_date) AS latest_source_as_of_date
  FROM analytics.fact_generation_realized_snapshot AS snapshot
  WHERE snapshot.effective_date = (SELECT effective_date FROM latest_generation_effective)
  GROUP BY snapshot.county_geoid
),
latest_grid_effective AS (
  SELECT MAX(snapshot.effective_date) AS effective_date
  FROM analytics.fact_grid_friction_snapshot AS snapshot
  CROSS JOIN runtime
  WHERE snapshot.effective_date <= runtime.data_version
),
grid_current AS (
  SELECT
    snapshot.county_geoid,
    snapshot.median_days_in_queue_active,
    snapshot.past_due_share,
    snapshot.market_withdrawal_prior,
    snapshot.congestion_proxy_score,
    snapshot.planned_transmission_upgrade_count AS planned_upgrade_count,
    snapshot.heatmap_signal_available AS heatmap_signal_flag,
    snapshot.source_pull_ts,
    snapshot.source_as_of_date
  FROM analytics.fact_grid_friction_snapshot AS snapshot
  WHERE snapshot.effective_date = (SELECT effective_date FROM latest_grid_effective)
),
latest_policy_effective AS (
  SELECT MAX(snapshot.effective_date) AS effective_date
  FROM analytics.fact_policy_snapshot AS snapshot
  CROSS JOIN runtime
  WHERE snapshot.effective_date <= runtime.data_version
),
policy_current AS (
  SELECT
    snapshot.county_geoid,
    snapshot.policy_constraint_score,
    snapshot.policy_momentum_score,
    COALESCE(snapshot.moratorium_status, 'unknown') AS moratorium_status,
    snapshot.public_sentiment_score,
    snapshot.policy_event_count,
    snapshot.county_tagged_event_share,
    snapshot.policy_mapping_confidence,
    snapshot.source_pull_ts,
    snapshot.source_as_of_date
  FROM analytics.fact_policy_snapshot AS snapshot
  WHERE snapshot.effective_date = (SELECT effective_date FROM latest_policy_effective)
),
latest_gas_effective AS (
  SELECT MAX(snapshot.effective_date) AS effective_date
  FROM analytics.fact_gas_snapshot AS snapshot
  CROSS JOIN runtime
  WHERE snapshot.effective_date <= runtime.data_version
),
gas_current AS (
  SELECT
    snapshot.county_geoid,
    snapshot.gas_pipeline_presence_flag,
    snapshot.gas_pipeline_mileage_county,
    snapshot.source_pull_ts,
    snapshot.source_as_of_date
  FROM analytics.fact_gas_snapshot AS snapshot
  WHERE snapshot.effective_date = (SELECT effective_date FROM latest_gas_effective)
),
water_basins AS (
  SELECT
    basin.id,
    basin.bws_score,
    basin.min_lng,
    basin.min_lat,
    basin.max_lng,
    basin.max_lat,
    ST_SetSRID(ST_GeomFromGeoJSON(basin.geometry::text), 4326) AS geom
  FROM mirror.water_stress_basins AS basin
  WHERE basin.geometry IS NOT NULL
    AND basin.bws_score IS NOT NULL
),
water_current AS (
  SELECT
    county.county_geoid,
    ROUND(water.bws_score::numeric, 4) AS water_stress_score
  FROM analytics.dim_county AS county
  LEFT JOIN LATERAL (
    SELECT basin.bws_score
    FROM water_basins AS basin
    WHERE ST_X(county.centroid) BETWEEN basin.min_lng AND basin.max_lng
      AND ST_Y(county.centroid) BETWEEN basin.min_lat AND basin.max_lat
      AND ST_Intersects(basin.geom, county.centroid)
    ORDER BY basin.bws_score DESC
    LIMIT 1
  ) AS water ON TRUE
),
primary_market AS (
  SELECT
    market.county_geoid,
    market.market_id AS primary_market_id,
    market.is_seam_county
  FROM analytics.bridge_county_market AS market
  WHERE market.is_primary_market
),
source_availability AS (
  SELECT
    true AS demand_available,
    (SELECT COUNT(*) > 0 FROM analytics.fact_dc_pipeline_snapshot WHERE publication_run_id <> :'run_id'::text) AS history_available,
    (SELECT COUNT(*) > 0 FROM analytics.bridge_county_market) AS market_seams_available,
    (
      (SELECT effective_date FROM latest_queue_effective) IS NOT NULL OR
      (SELECT effective_date FROM latest_generation_effective) IS NOT NULL
    ) AS supply_timeline_available,
    (
      (SELECT effective_date FROM latest_queue_effective) IS NOT NULL OR
      (SELECT effective_date FROM latest_grid_effective) IS NOT NULL
    ) AS grid_friction_available,
    (SELECT effective_date FROM latest_policy_effective) IS NOT NULL AS policy_available,
    (
      EXISTS (SELECT 1 FROM water_current WHERE water_stress_score IS NOT NULL) OR
      (SELECT effective_date FROM latest_gas_effective) IS NOT NULL OR
      (SELECT COUNT(*) > 0 FROM analytics.bridge_county_market)
    ) AS infrastructure_available,
    true AS narratives_available
),
county_rollup AS (
  SELECT
    county.county_geoid,
    county.county_name,
    county.state_abbrev,
    demand.expected_mw_0_24m,
    demand.expected_mw_24_60m,
    demand.recent_commissioned_mw_24m,
    demand.stalled_pipeline_mw,
    demand.stalled_facility_count,
    history.demand_momentum_qoq,
    history.what_changed_30d_json,
    history.what_changed_60d_json,
    history.what_changed_90d_json,
    provider_entries.provider_entry_count_12m,
    CASE
      WHEN availability.supply_timeline_available
        THEN COALESCE(queue.expected_supply_mw_0_36m, 0) + COALESCE(generation.proposed_mw, 0)
      ELSE NULL::numeric
    END AS expected_supply_mw_0_36m,
    CASE
      WHEN availability.supply_timeline_available
        THEN COALESCE(queue.expected_supply_mw_36_60m, 0)
      ELSE NULL::numeric
    END AS expected_supply_mw_36_60m,
    CASE
      WHEN availability.supply_timeline_available THEN COALESCE(queue.signed_ia_mw, 0)
      ELSE NULL::numeric
    END AS signed_ia_mw,
    CASE
      WHEN availability.supply_timeline_available THEN COALESCE(queue.queue_mw_active, 0)
      ELSE NULL::numeric
    END AS queue_mw_active,
    CASE
      WHEN availability.supply_timeline_available THEN COALESCE(queue.queue_project_count_active, 0)
      ELSE NULL::integer
    END AS queue_project_count_active,
    CASE
      WHEN availability.grid_friction_available
        THEN COALESCE(grid.median_days_in_queue_active, queue.median_days_in_queue_active)
      ELSE NULL::numeric
    END AS median_days_in_queue_active,
    CASE
      WHEN availability.grid_friction_available
        THEN COALESCE(grid.past_due_share, queue.past_due_share)
      ELSE NULL::numeric
    END AS past_due_share,
    CASE
      WHEN availability.grid_friction_available
        THEN COALESCE(grid.market_withdrawal_prior, queue.market_withdrawal_prior)
      ELSE NULL::numeric
    END AS market_withdrawal_prior,
    CASE
      WHEN availability.grid_friction_available THEN grid.congestion_proxy_score
      ELSE NULL::numeric
    END AS congestion_proxy_score,
    CASE
      WHEN availability.grid_friction_available
        THEN COALESCE(grid.planned_upgrade_count, queue.planned_upgrade_count, 0)
      ELSE NULL::integer
    END AS planned_upgrade_count,
    CASE
      WHEN availability.grid_friction_available THEN grid.heatmap_signal_flag
      ELSE NULL::boolean
    END AS heatmap_signal_flag,
    CASE
      WHEN availability.policy_available THEN policy.policy_constraint_score
      ELSE NULL::numeric
    END AS policy_constraint_score_input,
    CASE
      WHEN availability.policy_available THEN policy.policy_momentum_score
      ELSE NULL::numeric
    END AS policy_momentum_score,
    COALESCE(policy.moratorium_status, 'unknown') AS moratorium_status,
    CASE
      WHEN availability.policy_available THEN policy.public_sentiment_score
      ELSE NULL::numeric
    END AS public_sentiment_score,
    CASE
      WHEN availability.policy_available THEN policy.policy_event_count
      ELSE NULL::integer
    END AS policy_event_count,
    CASE
      WHEN availability.policy_available THEN policy.county_tagged_event_share
      ELSE NULL::numeric
    END AS county_tagged_event_share,
    CASE
      WHEN availability.policy_available THEN policy.policy_mapping_confidence
      ELSE NULL::text
    END AS policy_mapping_confidence,
    NULL::numeric(12, 2) AS transmission_miles_69kv_plus,
    NULL::numeric(12, 2) AS transmission_miles_230kv_plus,
    CASE
      WHEN (SELECT effective_date FROM latest_gas_effective) IS NOT NULL
        THEN gas.gas_pipeline_presence_flag
      ELSE NULL::boolean
    END AS gas_pipeline_presence_flag,
    CASE
      WHEN (SELECT effective_date FROM latest_gas_effective) IS NOT NULL
        THEN gas.gas_pipeline_mileage_county
      ELSE NULL::numeric
    END AS gas_pipeline_mileage_county,
    NULL::boolean AS fiber_presence_flag,
    water.water_stress_score,
    market.primary_market_id,
    COALESCE(market.is_seam_county, false) AS is_seam_county,
    GREATEST(
      COALESCE(demand.latest_source_pull_ts, '-infinity'::timestamptz),
      COALESCE(queue.latest_source_pull_ts, '-infinity'::timestamptz),
      COALESCE(generation.latest_source_pull_ts, '-infinity'::timestamptz),
      COALESCE(grid.source_pull_ts, '-infinity'::timestamptz),
      COALESCE(policy.source_pull_ts, '-infinity'::timestamptz),
      COALESCE(gas.source_pull_ts, '-infinity'::timestamptz),
      now()
    ) AS last_updated_at,
    GREATEST(
      COALESCE((SELECT data_version FROM runtime) - demand.latest_source_as_of_date, 0),
      COALESCE((SELECT data_version FROM runtime) - queue.latest_source_as_of_date, 0),
      COALESCE((SELECT data_version FROM runtime) - generation.latest_source_as_of_date, 0),
      COALESCE((SELECT data_version FROM runtime) - grid.source_as_of_date, 0),
      COALESCE((SELECT data_version FROM runtime) - policy.source_as_of_date, 0),
      COALESCE((SELECT data_version FROM runtime) - gas.source_as_of_date, 0),
      0
    ) AS max_source_age_days,
    availability.demand_available,
    availability.history_available,
    availability.market_seams_available,
    availability.supply_timeline_available,
    availability.grid_friction_available,
    availability.policy_available,
    availability.infrastructure_available,
    availability.narratives_available
  FROM analytics.dim_county AS county
  CROSS JOIN source_availability AS availability
  LEFT JOIN demand_current AS demand
    ON demand.county_geoid = county.county_geoid
  LEFT JOIN demand_history AS history
    ON history.county_geoid = county.county_geoid
  LEFT JOIN provider_entries_12m AS provider_entries
    ON provider_entries.county_geoid = county.county_geoid
  LEFT JOIN queue_current AS queue
    ON queue.county_geoid = county.county_geoid
  LEFT JOIN generation_current AS generation
    ON generation.county_geoid = county.county_geoid
  LEFT JOIN grid_current AS grid
    ON grid.county_geoid = county.county_geoid
  LEFT JOIN policy_current AS policy
    ON policy.county_geoid = county.county_geoid
  LEFT JOIN gas_current AS gas
    ON gas.county_geoid = county.county_geoid
  LEFT JOIN water_current AS water
    ON water.county_geoid = county.county_geoid
  LEFT JOIN primary_market AS market
    ON market.county_geoid = county.county_geoid
),
scored AS (
  SELECT
    rollup.*,
    ROUND(
      (
        100 * (
          0.55 * PERCENT_RANK() OVER (ORDER BY COALESCE(rollup.expected_mw_0_24m, 0) ASC) +
          0.25 * PERCENT_RANK() OVER (ORDER BY COALESCE(rollup.demand_momentum_qoq, 0) ASC) +
          0.20 * PERCENT_RANK() OVER (ORDER BY COALESCE(rollup.provider_entry_count_12m, 0) ASC)
        )
      )::numeric,
      4
    ) AS demand_pressure_score,
    CASE
      WHEN rollup.supply_timeline_available THEN ROUND(
        (
          100 * (
            0.60 * PERCENT_RANK() OVER (
              ORDER BY
                COALESCE(rollup.expected_mw_0_24m, 0) -
                COALESCE(rollup.expected_supply_mw_0_36m, 0) ASC
            ) +
            0.20 * PERCENT_RANK() OVER (
              ORDER BY COALESCE(rollup.queue_project_count_active, 0) ASC
            ) +
            0.20 * PERCENT_RANK() OVER (
              ORDER BY COALESCE(rollup.signed_ia_mw, 0) DESC
            )
          )
        )::numeric,
        4
      )
      ELSE NULL::numeric
    END AS supply_timeline_score,
    CASE
      WHEN rollup.grid_friction_available THEN ROUND(
        (
          100 * (
            0.35 * PERCENT_RANK() OVER (
              ORDER BY COALESCE(rollup.median_days_in_queue_active, 0) ASC
            ) +
            0.25 * PERCENT_RANK() OVER (
              ORDER BY COALESCE(rollup.past_due_share, 0) ASC
            ) +
            0.20 * PERCENT_RANK() OVER (
              ORDER BY COALESCE(rollup.market_withdrawal_prior, 0) ASC
            ) +
            0.20 * PERCENT_RANK() OVER (
              ORDER BY COALESCE(rollup.congestion_proxy_score, 0) ASC
            )
          )
        )::numeric,
        4
      )
      ELSE NULL::numeric
    END AS grid_friction_score,
    CASE
      WHEN rollup.policy_available THEN ROUND(
        COALESCE(
          rollup.policy_constraint_score_input,
          CASE
            WHEN rollup.moratorium_status = 'active' THEN 100
            WHEN rollup.moratorium_status = 'watch' THEN 70
            ELSE 0
          END
        )::numeric,
        4
      )
      ELSE NULL::numeric
    END AS policy_constraint_score,
    ROUND(
      GREATEST(0, 100 - (LEAST(COALESCE(rollup.max_source_age_days, 0), 50) * 2))::numeric,
      4
    ) AS freshness_score
  FROM county_rollup AS rollup
),
final_rows AS (
  SELECT
    score.county_geoid,
    score.county_name,
    score.state_abbrev,
    CASE
      WHEN score.moratorium_status = 'active' THEN 'blocked'
      WHEN NOT score.demand_available
        OR NOT score.supply_timeline_available
        OR NOT score.policy_available
        THEN 'deferred'
      ELSE 'ranked'
    END AS rank_status,
    CASE
      WHEN score.moratorium_status = 'active' THEN 'blocked'
      WHEN NOT score.demand_available
        OR NOT score.supply_timeline_available
        OR NOT score.policy_available
        THEN 'deferred'
      WHEN (
        0.40 * score.demand_pressure_score +
        0.30 * COALESCE(score.supply_timeline_score, 0) +
        0.20 * COALESCE(score.grid_friction_score, score.supply_timeline_score, 0) +
        0.10 * COALESCE(score.policy_constraint_score, 0)
      ) >= 70 THEN 'constrained'
      WHEN (
        0.40 * score.demand_pressure_score +
        0.30 * COALESCE(score.supply_timeline_score, 0) +
        0.20 * COALESCE(score.grid_friction_score, score.supply_timeline_score, 0) +
        0.10 * COALESCE(score.policy_constraint_score, 0)
      ) >= 40 THEN 'balanced'
      ELSE 'advantaged'
    END AS attractiveness_tier,
    CASE
      WHEN score.moratorium_status = 'active' THEN 'low'
      WHEN NOT score.demand_available
        OR NOT score.supply_timeline_available
        OR NOT score.policy_available
        THEN 'low'
      WHEN score.congestion_proxy_score IS NOT NULL OR score.heatmap_signal_flag IS NOT NULL THEN 'high'
      ELSE 'medium'
    END AS confidence_badge,
    CASE
      WHEN score.moratorium_status = 'active' THEN 100::numeric
      WHEN NOT score.demand_available
        OR NOT score.supply_timeline_available
        OR NOT score.policy_available
        THEN NULL::numeric
      ELSE ROUND(
        (
          0.40 * score.demand_pressure_score +
          0.30 * COALESCE(score.supply_timeline_score, 0) +
          0.20 * COALESCE(score.grid_friction_score, score.supply_timeline_score, 0) +
          0.10 * COALESCE(score.policy_constraint_score, 0)
        )::numeric,
        4
      )
    END AS market_pressure_index,
    score.demand_pressure_score,
    score.supply_timeline_score,
    score.grid_friction_score,
    score.policy_constraint_score,
    score.freshness_score,
    CASE
      WHEN COALESCE(score.demand_momentum_qoq, 0) >= 0.50 OR COALESCE(score.expected_mw_24_60m, 0) > COALESCE(score.expected_mw_0_24m, 0)
        THEN 'high'
      WHEN COALESCE(score.demand_momentum_qoq, 0) >= 0.15 OR COALESCE(score.expected_mw_0_24m, 0) > 0
        THEN 'medium'
      WHEN COALESCE(score.expected_mw_0_24m, 0) = 0 AND COALESCE(score.expected_mw_24_60m, 0) = 0
        THEN 'low'
      ELSE 'unknown'
    END AS source_volatility,
    score.last_updated_at,
    CASE
      WHEN score.moratorium_status = 'active'
        THEN 'Local policy conditions indicate a blocking constraint for near-term development.'
      WHEN NOT score.supply_timeline_available AND NOT score.policy_available
        THEN 'Demand pressure is visible, but queue and policy baselines are missing, so the county remains deferred.'
      WHEN NOT score.supply_timeline_available
        THEN 'Demand pressure is measurable, but supply timeline and queue evidence are missing, so the county remains deferred.'
      WHEN NOT score.policy_available
        THEN 'Demand and supply signals are present, but policy evidence is missing, so the county remains deferred.'
      WHEN (
        0.40 * score.demand_pressure_score +
        0.30 * COALESCE(score.supply_timeline_score, 0) +
        0.20 * COALESCE(score.grid_friction_score, score.supply_timeline_score, 0) +
        0.10 * COALESCE(score.policy_constraint_score, 0)
      ) >= 70
        THEN 'Combined demand pressure, supply timing, and grid friction point to a constrained market.'
      WHEN (
        0.40 * score.demand_pressure_score +
        0.30 * COALESCE(score.supply_timeline_score, 0) +
        0.20 * COALESCE(score.grid_friction_score, score.supply_timeline_score, 0) +
        0.10 * COALESCE(score.policy_constraint_score, 0)
      ) >= 40
        THEN 'Demand and supply signals are mixed, pointing to a balanced county profile.'
      ELSE 'Current pressure and friction signals remain relatively light for this county.'
    END AS narrative_summary,
    to_jsonb(
      ARRAY_REMOVE(
        ARRAY[
          CASE WHEN NOT score.demand_available THEN 'MISSING_DEMAND_BASELINE' END,
          CASE WHEN NOT score.supply_timeline_available THEN 'MISSING_QUEUE_BASELINE' END,
          CASE WHEN NOT score.policy_available THEN 'MISSING_POLICY_BASELINE' END,
          CASE WHEN score.freshness_score < 60 THEN 'STALE_SOURCE' END,
          CASE WHEN score.is_seam_county AND NOT score.market_seams_available THEN 'LOW_CONFIDENCE_MAPPING' END
        ],
        NULL::text
      )
    ) AS deferred_reason_codes_json,
    jsonb_build_object(
      'demand',
      CASE WHEN score.demand_available THEN 'observed' ELSE 'unknown' END,
      'supplyTimeline',
      CASE WHEN score.supply_timeline_available THEN 'observed' ELSE 'unknown' END,
      'gridFriction',
      CASE WHEN score.grid_friction_available THEN 'observed' ELSE 'unknown' END,
      'policy',
      CASE WHEN score.policy_available THEN 'observed' ELSE 'unknown' END,
      'infrastructure',
      CASE WHEN score.infrastructure_available THEN 'derived' ELSE 'unknown' END
    ) AS pillar_value_states_json,
    score.what_changed_30d_json,
    score.what_changed_60d_json,
    score.what_changed_90d_json,
    score.expected_mw_0_24m,
    score.expected_mw_24_60m,
    score.recent_commissioned_mw_24m,
    score.demand_momentum_qoq,
    score.provider_entry_count_12m,
    ROUND(score.expected_supply_mw_0_36m::numeric, 2) AS expected_supply_mw_0_36m,
    ROUND(score.expected_supply_mw_36_60m::numeric, 2) AS expected_supply_mw_36_60m,
    ROUND(score.signed_ia_mw::numeric, 2) AS signed_ia_mw,
    ROUND(score.queue_mw_active::numeric, 2) AS queue_mw_active,
    score.queue_project_count_active,
    ROUND(score.median_days_in_queue_active::numeric, 2) AS median_days_in_queue_active,
    ROUND(score.past_due_share::numeric, 6) AS past_due_share,
    ROUND(score.market_withdrawal_prior::numeric, 6) AS market_withdrawal_prior,
    ROUND(score.congestion_proxy_score::numeric, 4) AS congestion_proxy_score,
    score.planned_upgrade_count,
    score.heatmap_signal_flag,
    ROUND(score.policy_momentum_score::numeric, 4) AS policy_momentum_score,
    score.moratorium_status,
    ROUND(score.public_sentiment_score::numeric, 4) AS public_sentiment_score,
    score.policy_event_count,
    ROUND(score.county_tagged_event_share::numeric, 6) AS county_tagged_event_share,
    score.policy_mapping_confidence,
    score.transmission_miles_69kv_plus,
    score.transmission_miles_230kv_plus,
    score.gas_pipeline_presence_flag,
    score.gas_pipeline_mileage_county,
    score.fiber_presence_flag,
    score.water_stress_score,
    score.primary_market_id,
    score.is_seam_county
  FROM scored AS score
),
top_drivers AS (
  SELECT
    row.county_geoid,
    COALESCE(
      jsonb_agg(driver.driver_json ORDER BY driver.ordinal) FILTER (WHERE driver.driver_json IS NOT NULL),
      '[]'::jsonb
    ) AS top_drivers_json
  FROM final_rows AS row
  CROSS JOIN LATERAL (
    VALUES
      (
        1,
        CASE
          WHEN COALESCE(row.expected_mw_0_24m, 0) > 0 THEN jsonb_build_object(
            'code',
            'DEMAND_0_24M',
            'impact',
            'headwind',
            'label',
            'Near-term demand pipeline',
            'summary',
            format(
              'Stage-weighted expected demand in the next 24 months is %s MW.',
              COALESCE(ROUND(row.expected_mw_0_24m::numeric, 1)::text, '0')
            )
          )
          ELSE NULL
        END
      ),
      (
        2,
        CASE
          WHEN row.rank_status = 'deferred' THEN jsonb_build_object(
            'code',
            'DEFERRED_BASELINE',
            'impact',
            'blocker',
            'label',
            'Missing baseline',
            'summary',
            'Critical queue or policy coverage is missing, so the county remains deferred.'
          )
          ELSE NULL
        END
      ),
      (
        3,
        CASE
          WHEN row.moratorium_status = 'active' THEN jsonb_build_object(
            'code',
            'MORATORIUM',
            'impact',
            'blocker',
            'label',
            'Moratorium signal',
            'summary',
            'The current policy snapshot marks an active moratorium or equivalent block.'
          )
          ELSE NULL
        END
      ),
      (
        4,
        CASE
          WHEN row.is_seam_county THEN jsonb_build_object(
            'code',
            'MARKET_SEAM',
            'impact',
            'context',
            'label',
            'Market seam',
            'summary',
            'County overlaps multiple market footprints, which can complicate attribution and planning.'
          )
          ELSE NULL
        END
      ),
      (
        5,
        CASE
          WHEN COALESCE(row.water_stress_score, 0) >= 4 THEN jsonb_build_object(
            'code',
            'WATER_STRESS',
            'impact',
            'headwind',
            'label',
            'Water stress',
            'summary',
            'Supporting infrastructure context shows elevated baseline water stress.'
          )
          ELSE NULL
        END
      )
  ) AS driver(ordinal, driver_json)
  GROUP BY row.county_geoid
)
SELECT
  row.county_geoid,
  row.county_name,
  row.state_abbrev,
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
  COALESCE(driver.top_drivers_json, '[]'::jsonb) AS top_drivers_json,
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
  row.transmission_miles_69kv_plus,
  row.transmission_miles_230kv_plus,
  row.gas_pipeline_presence_flag,
  row.gas_pipeline_mileage_county,
  row.fiber_presence_flag,
  row.water_stress_score,
  row.primary_market_id,
  row.is_seam_county
FROM final_rows AS row
LEFT JOIN top_drivers AS driver
  ON driver.county_geoid = row.county_geoid;

INSERT INTO analytics.fact_market_analysis_score_snapshot (
  publication_run_id,
  county_geoid,
  county_name,
  state_abbrev,
  rank_status,
  attractiveness_tier,
  confidence_badge,
  market_pressure_index,
  demand_pressure_score,
  supply_timeline_score,
  grid_friction_score,
  policy_constraint_score,
  freshness_score,
  source_volatility,
  last_updated_at,
  narrative_summary,
  top_drivers_json,
  deferred_reason_codes_json,
  what_changed_30d_json,
  what_changed_60d_json,
  what_changed_90d_json,
  pillar_value_states_json,
  expected_mw_0_24m,
  expected_mw_24_60m,
  recent_commissioned_mw_24m,
  demand_momentum_qoq,
  provider_entry_count_12m,
  expected_supply_mw_0_36m,
  expected_supply_mw_36_60m,
  signed_ia_mw,
  queue_mw_active,
  queue_project_count_active,
  median_days_in_queue_active,
  past_due_share,
  market_withdrawal_prior,
  congestion_proxy_score,
  planned_upgrade_count,
  heatmap_signal_flag,
  policy_momentum_score,
  moratorium_status,
  public_sentiment_score,
  policy_event_count,
  county_tagged_event_share,
  policy_mapping_confidence,
  transmission_miles_69kv_plus,
  transmission_miles_230kv_plus,
  gas_pipeline_presence_flag,
  gas_pipeline_mileage_county,
  fiber_presence_flag,
  water_stress_score,
  primary_market_id,
  is_seam_county,
  formula_version,
  input_data_version,
  model_version
)
WITH input_versions AS (
  SELECT
    CONCAT_WS(
      ';',
      CONCAT(
        'dc_pipeline=',
        COALESCE(
          (SELECT MAX(source_as_of_date)::text FROM current_dc_pipeline_source),
          :'data_version'::text
        )
      ),
      CASE
        WHEN EXISTS (SELECT 1 FROM analytics.fact_gen_queue_snapshot) THEN CONCAT(
          'queue=',
          COALESCE(
            (
              SELECT MAX(source_as_of_date)::text
              FROM analytics.fact_gen_queue_snapshot
              WHERE effective_date <= :'data_version'::date
            ),
            'unknown'
          )
        )
        ELSE NULL
      END,
      CASE
        WHEN EXISTS (SELECT 1 FROM analytics.fact_generation_realized_snapshot) THEN CONCAT(
          'generation=',
          COALESCE(
            (
              SELECT MAX(source_as_of_date)::text
              FROM analytics.fact_generation_realized_snapshot
              WHERE effective_date <= :'data_version'::date
            ),
            'unknown'
          )
        )
        ELSE NULL
      END,
      CASE
        WHEN EXISTS (SELECT 1 FROM analytics.fact_grid_friction_snapshot) THEN CONCAT(
          'grid_friction=',
          COALESCE(
            (
              SELECT MAX(source_as_of_date)::text
              FROM analytics.fact_grid_friction_snapshot
              WHERE effective_date <= :'data_version'::date
            ),
            'unknown'
          )
        )
        ELSE NULL
      END,
      CASE
        WHEN EXISTS (SELECT 1 FROM analytics.fact_policy_snapshot) THEN CONCAT(
          'policy=',
          COALESCE(
            (
              SELECT MAX(source_as_of_date)::text
              FROM analytics.fact_policy_snapshot
              WHERE effective_date <= :'data_version'::date
            ),
            'unknown'
          )
        )
        ELSE NULL
      END,
      CASE
        WHEN EXISTS (SELECT 1 FROM analytics.fact_gas_snapshot) THEN CONCAT(
          'gas=',
          COALESCE(
            (
              SELECT MAX(source_as_of_date)::text
              FROM analytics.fact_gas_snapshot
              WHERE effective_date <= :'data_version'::date
            ),
            'unknown'
          )
        )
        ELSE NULL
      END,
      'water=mirror.water_stress_basins'
    ) AS input_data_version
)
SELECT
  :'run_id'::text,
  stage.county_geoid,
  stage.county_name,
  stage.state_abbrev,
  stage.rank_status,
  stage.attractiveness_tier,
  stage.confidence_badge,
  stage.market_pressure_index,
  stage.demand_pressure_score,
  stage.supply_timeline_score,
  stage.grid_friction_score,
  stage.policy_constraint_score,
  stage.freshness_score,
  stage.source_volatility,
  stage.last_updated_at,
  stage.narrative_summary,
  stage.top_drivers_json,
  stage.deferred_reason_codes_json,
  stage.what_changed_30d_json,
  stage.what_changed_60d_json,
  stage.what_changed_90d_json,
  stage.pillar_value_states_json,
  stage.expected_mw_0_24m,
  stage.expected_mw_24_60m,
  stage.recent_commissioned_mw_24m,
  stage.demand_momentum_qoq,
  stage.provider_entry_count_12m,
  stage.expected_supply_mw_0_36m,
  stage.expected_supply_mw_36_60m,
  stage.signed_ia_mw,
  stage.queue_mw_active,
  stage.queue_project_count_active,
  stage.median_days_in_queue_active,
  stage.past_due_share,
  stage.market_withdrawal_prior,
  stage.congestion_proxy_score,
  stage.planned_upgrade_count,
  stage.heatmap_signal_flag,
  stage.policy_momentum_score,
  stage.moratorium_status,
  stage.public_sentiment_score,
  stage.policy_event_count,
  stage.county_tagged_event_share,
  stage.policy_mapping_confidence,
  stage.transmission_miles_69kv_plus,
  stage.transmission_miles_230kv_plus,
  stage.gas_pipeline_presence_flag,
  stage.gas_pipeline_mileage_county,
  stage.fiber_presence_flag,
  stage.water_stress_score,
  stage.primary_market_id,
  stage.is_seam_county,
  :'formula_version'::text,
  input_versions.input_data_version,
  :'formula_version'::text
FROM county_market_pressure_stage AS stage
CROSS JOIN input_versions;

INSERT INTO analytics.fact_narrative_snapshot (
  publication_run_id,
  county_geoid,
  narrative_summary,
  narrative_json
)
SELECT
  :'run_id'::text,
  stage.county_geoid,
  stage.narrative_summary,
  jsonb_build_object(
    'top_drivers',
    stage.top_drivers_json,
    'what_changed_30d',
    stage.what_changed_30d_json,
    'what_changed_60d',
    stage.what_changed_60d_json,
    'what_changed_90d',
    stage.what_changed_90d_json
  )
FROM county_market_pressure_stage AS stage
ON CONFLICT (publication_run_id, county_geoid) DO UPDATE
SET
  narrative_summary = EXCLUDED.narrative_summary,
  narrative_json = EXCLUDED.narrative_json;

INSERT INTO analytics.county_market_pressure_current (
  county_geoid,
  county_name,
  state_abbrev,
  publication_run_id,
  rank_status,
  attractiveness_tier,
  confidence_badge,
  market_pressure_index,
  demand_pressure_score,
  supply_timeline_score,
  grid_friction_score,
  policy_constraint_score,
  freshness_score,
  source_volatility,
  last_updated_at,
  narrative_summary,
  top_drivers_json,
  deferred_reason_codes_json,
  what_changed_30d_json,
  what_changed_60d_json,
  what_changed_90d_json,
  pillar_value_states_json,
  expected_mw_0_24m,
  expected_mw_24_60m,
  recent_commissioned_mw_24m,
  demand_momentum_qoq,
  provider_entry_count_12m,
  expected_supply_mw_0_36m,
  expected_supply_mw_36_60m,
  signed_ia_mw,
  queue_mw_active,
  queue_project_count_active,
  median_days_in_queue_active,
  past_due_share,
  market_withdrawal_prior,
  congestion_proxy_score,
  planned_upgrade_count,
  heatmap_signal_flag,
  policy_momentum_score,
  moratorium_status,
  public_sentiment_score,
  policy_event_count,
  county_tagged_event_share,
  policy_mapping_confidence,
  transmission_miles_69kv_plus,
  transmission_miles_230kv_plus,
  gas_pipeline_presence_flag,
  gas_pipeline_mileage_county,
  fiber_presence_flag,
  water_stress_score,
  primary_market_id,
  is_seam_county,
  formula_version,
  input_data_version,
  model_version
)
SELECT
  snapshot.county_geoid,
  snapshot.county_name,
  snapshot.state_abbrev,
  snapshot.publication_run_id,
  snapshot.rank_status,
  snapshot.attractiveness_tier,
  snapshot.confidence_badge,
  snapshot.market_pressure_index,
  snapshot.demand_pressure_score,
  snapshot.supply_timeline_score,
  snapshot.grid_friction_score,
  snapshot.policy_constraint_score,
  snapshot.freshness_score,
  snapshot.source_volatility,
  snapshot.last_updated_at,
  snapshot.narrative_summary,
  snapshot.top_drivers_json,
  snapshot.deferred_reason_codes_json,
  snapshot.what_changed_30d_json,
  snapshot.what_changed_60d_json,
  snapshot.what_changed_90d_json,
  snapshot.pillar_value_states_json,
  snapshot.expected_mw_0_24m,
  snapshot.expected_mw_24_60m,
  snapshot.recent_commissioned_mw_24m,
  snapshot.demand_momentum_qoq,
  snapshot.provider_entry_count_12m,
  snapshot.expected_supply_mw_0_36m,
  snapshot.expected_supply_mw_36_60m,
  snapshot.signed_ia_mw,
  snapshot.queue_mw_active,
  snapshot.queue_project_count_active,
  snapshot.median_days_in_queue_active,
  snapshot.past_due_share,
  snapshot.market_withdrawal_prior,
  snapshot.congestion_proxy_score,
  snapshot.planned_upgrade_count,
  snapshot.heatmap_signal_flag,
  snapshot.policy_momentum_score,
  snapshot.moratorium_status,
  snapshot.public_sentiment_score,
  snapshot.policy_event_count,
  snapshot.county_tagged_event_share,
  snapshot.policy_mapping_confidence,
  snapshot.transmission_miles_69kv_plus,
  snapshot.transmission_miles_230kv_plus,
  snapshot.gas_pipeline_presence_flag,
  snapshot.gas_pipeline_mileage_county,
  snapshot.fiber_presence_flag,
  snapshot.water_stress_score,
  snapshot.primary_market_id,
  snapshot.is_seam_county,
  snapshot.formula_version,
  snapshot.input_data_version,
  snapshot.model_version
FROM analytics.fact_market_analysis_score_snapshot AS snapshot
WHERE snapshot.publication_run_id = :'run_id'::text;

INSERT INTO analytics.fact_publication (
  publication_run_id,
  status,
  model_version,
  methodology_id,
  formula_version,
  data_version,
  input_data_version,
  source_versions_json,
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
  published_at,
  as_of_date,
  notes
)
WITH feature_families AS (
  SELECT
    ARRAY_REMOVE(
      ARRAY[
        CASE WHEN true THEN 'demand' END,
        CASE WHEN EXISTS (SELECT 1 FROM analytics.fact_dc_pipeline_snapshot WHERE publication_run_id <> :'run_id'::text) THEN 'history' END,
        CASE WHEN EXISTS (SELECT 1 FROM analytics.bridge_county_market) THEN 'market_seams' END,
        CASE
          WHEN EXISTS (SELECT 1 FROM analytics.fact_gen_queue_snapshot WHERE effective_date <= :'data_version'::date)
            OR EXISTS (SELECT 1 FROM analytics.fact_generation_realized_snapshot WHERE effective_date <= :'data_version'::date)
            THEN 'supply_timeline'
        END,
        CASE
          WHEN EXISTS (SELECT 1 FROM analytics.fact_gen_queue_snapshot WHERE effective_date <= :'data_version'::date)
            OR EXISTS (SELECT 1 FROM analytics.fact_grid_friction_snapshot WHERE effective_date <= :'data_version'::date)
            THEN 'grid_friction'
        END,
        CASE WHEN EXISTS (SELECT 1 FROM analytics.fact_policy_snapshot WHERE effective_date <= :'data_version'::date) THEN 'policy' END,
        CASE
          WHEN EXISTS (SELECT 1 FROM analytics.bridge_county_market)
            OR EXISTS (SELECT 1 FROM analytics.fact_gas_snapshot WHERE effective_date <= :'data_version'::date)
            OR EXISTS (
              SELECT 1
              FROM county_market_pressure_stage
              WHERE water_stress_score IS NOT NULL
            )
            THEN 'infrastructure'
        END,
        'narratives'
      ],
      NULL::text
    ) AS available_feature_families
),
publication_versions AS (
  SELECT
    jsonb_strip_nulls(
      jsonb_build_object(
        'dc_pipeline',
        (SELECT MAX(source_as_of_date)::text FROM current_dc_pipeline_source),
        'queue',
        (
          SELECT MAX(source_as_of_date)::text
          FROM analytics.fact_gen_queue_snapshot
          WHERE effective_date <= :'data_version'::date
        ),
        'generation',
        (
          SELECT MAX(source_as_of_date)::text
          FROM analytics.fact_generation_realized_snapshot
          WHERE effective_date <= :'data_version'::date
        ),
        'grid_friction',
        (
          SELECT MAX(source_as_of_date)::text
          FROM analytics.fact_grid_friction_snapshot
          WHERE effective_date <= :'data_version'::date
        ),
        'policy',
        (
          SELECT MAX(source_as_of_date)::text
          FROM analytics.fact_policy_snapshot
          WHERE effective_date <= :'data_version'::date
        ),
        'gas',
        (
          SELECT MAX(source_as_of_date)::text
          FROM analytics.fact_gas_snapshot
          WHERE effective_date <= :'data_version'::date
        ),
        'water',
        'mirror.water_stress_basins'
      )
    ) AS source_versions_json
),
counts AS (
  SELECT
    COUNT(*)::integer AS row_count,
    COUNT(*) FILTER (WHERE rank_status = 'ranked')::integer AS ranked_county_count,
    COUNT(*) FILTER (WHERE rank_status = 'deferred')::integer AS deferred_county_count,
    COUNT(*) FILTER (WHERE rank_status = 'blocked')::integer AS blocked_county_count,
    COUNT(*) FILTER (WHERE confidence_badge = 'high')::integer AS high_confidence_count,
    COUNT(*) FILTER (WHERE confidence_badge = 'medium')::integer AS medium_confidence_count,
    COUNT(*) FILTER (WHERE confidence_badge = 'low')::integer AS low_confidence_count,
    COUNT(*) FILTER (WHERE freshness_score >= 70)::integer AS fresh_county_count
  FROM county_market_pressure_stage
)
SELECT
  :'run_id'::text,
  'published',
  :'formula_version'::text,
  :'methodology_id'::text,
  :'formula_version'::text,
  :'data_version'::text,
  snapshot.input_data_version,
  publication_versions.source_versions_json,
  feature_families.available_feature_families,
  ARRAY(
    SELECT family
    FROM unnest(
      ARRAY[
        'demand',
        'history',
        'market_seams',
        'supply_timeline',
        'grid_friction',
        'policy',
        'infrastructure',
        'narratives'
      ]::text[]
    ) AS family
    WHERE NOT family = ANY(feature_families.available_feature_families)
  ),
  (SELECT COUNT(*)::integer FROM analytics.dim_county),
  counts.row_count,
  counts.ranked_county_count,
  counts.deferred_county_count,
  counts.blocked_county_count,
  counts.high_confidence_count,
  counts.medium_confidence_count,
  counts.low_confidence_count,
  counts.fresh_county_count,
  now(),
  :'data_version'::date,
  jsonb_build_object(
    'summary',
    'County market-pressure publication with explicit demand, queue, friction, policy, freshness, and deferred-state semantics.'
  )
FROM (
  SELECT DISTINCT input_data_version
  FROM analytics.fact_market_analysis_score_snapshot
  WHERE publication_run_id = :'run_id'::text
  LIMIT 1
) AS snapshot
CROSS JOIN publication_versions
CROSS JOIN feature_families
CROSS JOIN counts
ON CONFLICT (publication_run_id) DO UPDATE
SET
  status = EXCLUDED.status,
  model_version = EXCLUDED.model_version,
  methodology_id = EXCLUDED.methodology_id,
  formula_version = EXCLUDED.formula_version,
  data_version = EXCLUDED.data_version,
  input_data_version = EXCLUDED.input_data_version,
  source_versions_json = EXCLUDED.source_versions_json,
  available_feature_families = EXCLUDED.available_feature_families,
  missing_feature_families = EXCLUDED.missing_feature_families,
  source_county_count = EXCLUDED.source_county_count,
  row_count = EXCLUDED.row_count,
  ranked_county_count = EXCLUDED.ranked_county_count,
  deferred_county_count = EXCLUDED.deferred_county_count,
  blocked_county_count = EXCLUDED.blocked_county_count,
  high_confidence_count = EXCLUDED.high_confidence_count,
  medium_confidence_count = EXCLUDED.medium_confidence_count,
  low_confidence_count = EXCLUDED.low_confidence_count,
  fresh_county_count = EXCLUDED.fresh_county_count,
  published_at = EXCLUDED.published_at,
  as_of_date = EXCLUDED.as_of_date,
  notes = EXCLUDED.notes;

ANALYZE analytics.dim_county;
ANALYZE analytics.bridge_county_adjacency;
ANALYZE analytics.bridge_county_market;
ANALYZE analytics.fact_dc_pipeline_project;
ANALYZE analytics.fact_dc_pipeline_snapshot;
ANALYZE analytics.fact_market_analysis_score_snapshot;
ANALYZE analytics.fact_publication;
ANALYZE analytics.county_market_pressure_current;

COMMIT;

BEGIN;

TRUNCATE TABLE analytics.county_metrics_v1;
TRUNCATE TABLE analytics.county_scores_v1;

WITH county_reference AS (
  SELECT
    county_fips,
    county_name,
    state_abbrev,
    geom,
    geom_3857,
    ST_PointOnSurface(geom) AS point_geom,
    area_sqkm
  FROM serve.boundary_county_geom_lod1
),
publication_config AS (
  SELECT
    :'methodology_id'::text AS methodology_id,
    ARRAY['facilities', 'hyperscale', 'water_stress']::text[] AS available_feature_families,
    ARRAY[
      'enterprise',
      'utility_territory',
      'transmission',
      'terrain',
      'hazards',
      'fiber',
      'policy'
    ]::text[] AS missing_feature_families
),
facility_metrics AS (
  SELECT
    county_fips,
    COUNT(*)::integer AS facility_count,
    ROUND(SUM(commissioned_power_mw), 2) AS commissioned_power_mw,
    ROUND(SUM(planned_power_mw), 2) AS planned_power_mw,
    ROUND(SUM(under_construction_power_mw), 2) AS under_construction_power_mw
  FROM serve.facility_site
  WHERE county_fips IS NOT NULL
  GROUP BY county_fips
),
hyperscale_metrics AS (
  SELECT
    county_fips,
    COUNT(*)::integer AS hyperscale_count,
    ROUND(SUM(commissioned_power_mw), 2) AS commissioned_power_mw,
    ROUND(SUM(planned_power_mw), 2) AS planned_power_mw,
    ROUND(SUM(under_construction_power_mw), 2) AS under_construction_power_mw
  FROM serve.hyperscale_site
  WHERE county_fips IS NOT NULL
  GROUP BY county_fips
),
water_basins AS (
  SELECT
    id,
    bws_score,
    min_lng,
    min_lat,
    max_lng,
    max_lat,
    ST_SetSRID(ST_GeomFromGeoJSON(geometry::text), 4326) AS geom
  FROM mirror.water_stress_basins
  WHERE geometry IS NOT NULL
    AND bws_score IS NOT NULL
),
water_metrics AS (
  SELECT
    county.county_fips,
    ROUND(water.bws_score::numeric, 6) AS water_stress_score,
    ROUND(water.bws_score::numeric, 6) AS peak_water_stress_score
  FROM county_reference AS county
  LEFT JOIN LATERAL (
    SELECT basin.bws_score
    FROM water_basins AS basin
    WHERE ST_X(county.point_geom) BETWEEN basin.min_lng AND basin.max_lng
      AND ST_Y(county.point_geom) BETWEEN basin.min_lat AND basin.max_lat
      AND ST_Intersects(basin.geom, county.point_geom)
    ORDER BY basin.bws_score DESC
    LIMIT 1
  ) AS water ON TRUE
),
input_versions AS (
  SELECT
    CONCAT_WS(
      ';',
      CONCAT('facilities=', COALESCE(MAX(NULLIF(facility.data_version, '')), :'data_version')),
      CONCAT('hyperscale=', COALESCE(MAX(NULLIF(hyperscale.data_version, '')), :'data_version')),
      'water=mirror.water_stress_basins'
    ) AS input_data_version
  FROM serve.facility_site AS facility
  FULL OUTER JOIN serve.hyperscale_site AS hyperscale
    ON FALSE
),
metrics_source AS (
  SELECT
    county.county_fips,
    :'data_version'::text AS data_version,
    input_versions.input_data_version,
    now() AS computed_at,
    :'formula_version'::text AS formula_version,
    ARRAY[:'run_id'::text] AS dependency_run_ids,
    COALESCE(facility.facility_count, 0) AS facility_count,
    COALESCE(hyperscale.hyperscale_count, 0) AS hyperscale_count,
    0::integer AS enterprise_count,
    ROUND(
      COALESCE(facility.commissioned_power_mw, 0) + COALESCE(hyperscale.commissioned_power_mw, 0),
      2
    ) AS commissioned_power_mw,
    ROUND(
      COALESCE(facility.planned_power_mw, 0) + COALESCE(hyperscale.planned_power_mw, 0),
      2
    ) AS planned_power_mw,
    ROUND(
      COALESCE(facility.under_construction_power_mw, 0) +
        COALESCE(hyperscale.under_construction_power_mw, 0),
      2
    ) AS under_construction_power_mw,
    jsonb_strip_nulls(jsonb_build_object(
      'county_name',
      county.county_name,
      'state_abbrev',
      county.state_abbrev,
      'county_area_sqkm',
      county.area_sqkm,
      'water_stress_score',
      water.water_stress_score,
      'peak_water_stress_score',
      water.peak_water_stress_score
    )) AS quality_flags
  FROM county_reference AS county
  CROSS JOIN input_versions
  LEFT JOIN facility_metrics AS facility
    ON facility.county_fips = county.county_fips
  LEFT JOIN hyperscale_metrics AS hyperscale
    ON hyperscale.county_fips = county.county_fips
  LEFT JOIN water_metrics AS water
    ON water.county_fips = county.county_fips
),
inserted_metrics AS (
  INSERT INTO analytics.county_metrics_v1 (
    county_fips,
    data_version,
    input_data_version,
    computed_at,
    formula_version,
    dependency_run_ids,
    facility_count,
    hyperscale_count,
    enterprise_count,
    commissioned_power_mw,
    planned_power_mw,
    under_construction_power_mw,
    quality_flags
  )
  SELECT
    county_fips,
    data_version,
    input_data_version,
    computed_at,
    formula_version,
    dependency_run_ids,
    facility_count,
    hyperscale_count,
    enterprise_count,
    commissioned_power_mw,
    planned_power_mw,
    under_construction_power_mw,
    quality_flags
  FROM metrics_source
  RETURNING *
),
scored_metrics AS (
  SELECT
    metric.*,
    100 * (
      0.45 * PERCENT_RANK() OVER (ORDER BY metric.facility_count ASC) +
      0.25 * PERCENT_RANK() OVER (ORDER BY metric.hyperscale_count ASC) +
      0.30 * PERCENT_RANK() OVER (ORDER BY metric.commissioned_power_mw ASC)
    ) AS demand_score_raw,
    100 * (
      0.50 * PERCENT_RANK() OVER (ORDER BY metric.commissioned_power_mw ASC) +
      0.30 * PERCENT_RANK() OVER (ORDER BY metric.under_construction_power_mw ASC) +
      0.20 * PERCENT_RANK() OVER (ORDER BY metric.planned_power_mw ASC)
    ) AS generation_score_raw,
    100 * (
      0.55 * PERCENT_RANK() OVER (
        ORDER BY COALESCE((metric.quality_flags ->> 'water_stress_score')::numeric, 5) DESC
      ) +
      0.45 * PERCENT_RANK() OVER (
        ORDER BY (metric.planned_power_mw + metric.under_construction_power_mw) DESC
      )
    ) AS policy_score_raw
  FROM inserted_metrics AS metric
),
inserted_scores AS (
  INSERT INTO analytics.county_scores_v1 (
    county_fips,
    data_version,
    input_data_version,
    computed_at,
    formula_version,
    dependency_run_ids,
    demand_score,
    generation_score,
    policy_score,
    composite_score,
    explanation,
    quality_flags
  )
  SELECT
    county_fips,
    data_version,
    input_data_version,
    computed_at,
    formula_version,
    dependency_run_ids,
    ROUND(demand_score_raw::numeric, 4) AS demand_score,
    ROUND(generation_score_raw::numeric, 4) AS generation_score,
    ROUND(policy_score_raw::numeric, 4) AS policy_score,
    ROUND((0.40 * demand_score_raw + 0.40 * generation_score_raw + 0.20 * policy_score_raw)::numeric, 4)
      AS composite_score,
    jsonb_build_object(
      'methodology_id',
      publication_config.methodology_id,
      'formula_version',
      :'formula_version'::text,
      'components',
      jsonb_build_object(
        'demand',
        jsonb_build_object(
          'facility_count',
          facility_count,
          'hyperscale_count',
          hyperscale_count,
          'commissioned_power_mw',
          commissioned_power_mw
        ),
        'generation',
        jsonb_build_object(
          'commissioned_power_mw',
          commissioned_power_mw,
          'planned_power_mw',
          planned_power_mw,
          'under_construction_power_mw',
          under_construction_power_mw
        ),
        'policy',
        jsonb_build_object(
          'water_stress_score',
          quality_flags -> 'water_stress_score',
          'future_power_mw',
          planned_power_mw + under_construction_power_mw
        )
      )
    ) AS explanation,
    quality_flags
  FROM scored_metrics
  CROSS JOIN publication_config
  RETURNING county_fips, quality_flags
),
publication_summary AS (
  SELECT
    (SELECT COUNT(*)::integer FROM county_reference) AS source_county_count,
    COUNT(*)::integer AS scored_county_count,
    COUNT(*) FILTER (
      WHERE quality_flags ? 'water_stress_score'
        AND quality_flags ->> 'water_stress_score' IS NOT NULL
    )::integer AS water_coverage_count
  FROM inserted_scores
)
INSERT INTO analytics_meta.county_score_publications (
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
  water_coverage_count,
  notes
)
SELECT
  :'run_id'::text,
  'published',
  now(),
  :'data_version'::text,
  input_versions.input_data_version,
  :'formula_version'::text,
  publication_config.methodology_id,
  publication_config.available_feature_families,
  publication_config.missing_feature_families,
  publication_summary.source_county_count,
  publication_summary.scored_county_count,
  publication_summary.water_coverage_count,
  jsonb_build_object(
    'summary',
    'County intelligence publication with partial feature-family coverage.'
  )
FROM input_versions
CROSS JOIN publication_config
CROSS JOIN publication_summary;

ANALYZE analytics.county_metrics_v1;
ANALYZE analytics.county_scores_v1;

COMMIT;

BEGIN;

DO $$
BEGIN
  IF to_regclass('serve.boundary_county_geom_lod1') IS NULL THEN
    RAISE EXCEPTION 'missing county boundary source: serve.boundary_county_geom_lod1';
  END IF;
END $$;

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

ANALYZE analytics.dim_county;
ANALYZE analytics.bridge_county_market;

COMMIT;

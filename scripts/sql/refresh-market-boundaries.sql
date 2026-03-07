BEGIN;

TRUNCATE TABLE market_current.market_boundaries;

WITH searchable_markets AS (
  SELECT
    market."MARKET_ID"::text AS market_id,
    market."NAME" AS market_name,
    NULLIF(market."COUNTRY", '') AS country,
    NULLIF(market."STATE", '') AS state,
    ST_SetSRID(
      ST_MakePoint(
        market."LONGITUDE"::double precision,
        market."LATITUDE"::double precision
      ),
      4326
    ) AS center_geom
  FROM mirror."HAWK_MARKET" AS market
  WHERE COALESCE(market."SEARCH_PAGE", 0) = 1
    AND market."NAME" IS NOT NULL
    AND market."LATITUDE" IS NOT NULL
    AND market."LONGITUDE" IS NOT NULL
),
colo_points AS (
  SELECT
    product."MARKET_ID"::text AS market_id,
    ST_SetSRID(
      ST_MakePoint(
        facility_location."LONGITUDE"::double precision,
        facility_location."LATITUDE"::double precision
      ),
      4326
    ) AS geom
  FROM legacy."BLC_PRODUCT" AS product
  INNER JOIN mirror."HAWK_FACILITY_LOCATION" AS facility_location
    ON facility_location."FACILITY_LOCATION_ID"::text = product."FACILITY_LOCATION_ID"
  WHERE COALESCE(product."ARCHIVED", 'N') <> 'Y'
    AND COALESCE(product."OPT_OUT", '0') = '0'
    AND product."PRODUCT_TYPE" = 'COLOCATION'
    AND facility_location."LATITUDE" IS NOT NULL
    AND facility_location."LONGITUDE" IS NOT NULL
),
hyperscale_points AS (
  SELECT
    facility."MARKET"::text AS market_id,
    ST_SetSRID(
      ST_MakePoint(
        facility."LONGITUDE"::double precision,
        facility."LATITUDE"::double precision
      ),
      4326
    ) AS geom
  FROM mirror."HYPERSCALE_FACILITY" AS facility
  WHERE COALESCE(facility."ARCHIVED", 'N') <> 'Y'
    AND facility."LATITUDE" IS NOT NULL
    AND facility."LONGITUDE" IS NOT NULL
),
facility_points AS (
  SELECT market_id, geom FROM colo_points
  UNION ALL
  SELECT market_id, geom FROM hyperscale_points
),
submarket_points AS (
  SELECT
    market.market_id,
    submarket.geom
  FROM searchable_markets AS market
  INNER JOIN spatial.submarket_points AS submarket
    ON submarket.market = market.market_name
),
observed_points AS (
  SELECT market_id, geom FROM facility_points
  UNION ALL
  SELECT market_id, geom FROM submarket_points
),
point_groups AS (
  SELECT
    market_id,
    COUNT(*) AS point_count,
    ST_Collect(geom) AS collected_geom
  FROM observed_points
  GROUP BY market_id
),
county_signal_points AS (
  SELECT
    market.market_id,
    county.county_fips,
    county.geom
  FROM searchable_markets AS market
  INNER JOIN observed_points AS point
    ON point.market_id = market.market_id
  INNER JOIN serve.boundary_county_geom_lod3 AS county
    ON market.country = 'US'
   AND ST_Intersects(county.geom, point.geom)
),
county_unions AS (
  SELECT
    market_id,
    ST_UnaryUnion(ST_Collect(geom)) AS geom
  FROM (
    SELECT DISTINCT market_id, county_fips, geom
    FROM county_signal_points
  ) AS deduped_counties
  GROUP BY market_id
),
point_hulls AS (
  SELECT
    market.market_id,
    CASE
      WHEN point_group.point_count >= 5 THEN ST_Transform(
        ST_Buffer(
          ST_Transform(ST_ConcaveHull(point_group.collected_geom, 0.75, true), 3857),
          15000
        ),
        4326
      )
      WHEN point_group.point_count >= 3 THEN ST_Transform(
        ST_Buffer(
          ST_Transform(ST_ConcaveHull(point_group.collected_geom, 0.9, true), 3857),
          20000
        ),
        4326
      )
      WHEN point_group.point_count = 2 THEN ST_Transform(
        ST_Buffer(ST_Transform(ST_ConvexHull(point_group.collected_geom), 3857), 30000),
        4326
      )
      WHEN point_group.point_count = 1 THEN ST_Buffer(
        ST_Centroid(point_group.collected_geom)::geography,
        50000
      )::geometry
      ELSE ST_Buffer(market.center_geom::geography, 50000)::geometry
    END AS geom
  FROM searchable_markets AS market
  LEFT JOIN point_groups AS point_group
    ON point_group.market_id = market.market_id
),
final_boundaries AS (
  SELECT
    market.market_id,
    ST_Multi(
      ST_CollectionExtract(
        ST_MakeValid(COALESCE(county_union.geom, point_hull.geom)),
        3
      )
    ) AS geom
  FROM searchable_markets AS market
  LEFT JOIN county_unions AS county_union
    ON county_union.market_id = market.market_id
  LEFT JOIN point_hulls AS point_hull
    ON point_hull.market_id = market.market_id
)
INSERT INTO market_current.market_boundaries (
  market_id,
  geom,
  center,
  source_version
)
SELECT
  boundary.market_id,
  boundary.geom,
  ST_PointOnSurface(boundary.geom) AS center,
  'derived-market-boundaries-v1'
FROM final_boundaries AS boundary
WHERE boundary.geom IS NOT NULL
  AND NOT ST_IsEmpty(boundary.geom);

ANALYZE market_current.market_boundaries;

COMMIT;

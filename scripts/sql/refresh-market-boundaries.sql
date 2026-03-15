BEGIN;

DO $$
BEGIN
  IF to_regclass('market_source.markets') IS NULL THEN
    RAISE EXCEPTION 'market_source.markets is required; run bun run sync:market-source first';
  END IF;

  IF to_regclass('market_source.submarkets') IS NULL THEN
    RAISE EXCEPTION 'market_source.submarkets is required; run bun run sync:market-source first';
  END IF;
END $$;

TRUNCATE TABLE market_current.market_boundaries, market_current.submarket_points, market_current.markets;

WITH searchable_markets AS (
  SELECT
    market.market_id,
    market.name,
    market.center
  FROM market_source.markets AS market
  WHERE market.market_id IS NOT NULL
),
county_markets AS (
  SELECT DISTINCT
    bridge.market_id,
    county.county_fips,
    county.geom
  FROM analytics.bridge_county_market AS bridge
  INNER JOIN serve.boundary_county_geom_lod3 AS county
    ON county.county_fips = bridge.county_geoid
  WHERE bridge.market_id IS NOT NULL
),
county_unions AS (
  SELECT
    county_market.market_id,
    ST_UnaryUnion(ST_Collect(county_market.geom)) AS geom
  FROM county_markets AS county_market
  GROUP BY county_market.market_id
),
facility_points AS (
  SELECT
    submarket.market_id,
    submarket.geom
  FROM market_source.submarkets AS submarket
  WHERE submarket.market_id IS NOT NULL
    AND submarket.geom IS NOT NULL
  UNION ALL
  SELECT
    point.market_id,
    point.geom
  FROM market_source.colocation_points AS point
  WHERE point.market_id IS NOT NULL
    AND point.geom IS NOT NULL
  UNION ALL
  SELECT
    point.market_id,
    point.geom
  FROM market_source.hyperscale_points AS point
  WHERE point.market_id IS NOT NULL
    AND point.geom IS NOT NULL
  UNION ALL
  SELECT
    market.market_id,
    point.geom
  FROM spatial.submarket_points AS point
  INNER JOIN searchable_markets AS market
    ON LOWER(BTRIM(point.market)) = LOWER(BTRIM(market.name))
  WHERE point.geom IS NOT NULL
),
markets_with_facilities AS (
  SELECT DISTINCT market_id FROM facility_points
),
point_sources AS (
  SELECT market_id, geom FROM facility_points
  UNION ALL
  SELECT
    market.market_id,
    market.center AS geom
  FROM searchable_markets AS market
  INNER JOIN markets_with_facilities AS mwf
    ON mwf.market_id = market.market_id
  WHERE market.center IS NOT NULL
),
deduplicated_points AS (
  SELECT DISTINCT ON (market_id, ST_X(geom), ST_Y(geom))
    market_id, geom
  FROM point_sources
),
point_groups AS (
  SELECT
    dp.market_id,
    COUNT(*) AS point_count,
    ST_Collect(dp.geom) AS collected_geom
  FROM deduplicated_points AS dp
  GROUP BY dp.market_id
),
point_hulls AS (
  SELECT
    market.market_id,
    CASE
      WHEN point_group.point_count >= 5 THEN ST_Transform(
        ST_Buffer(
          ST_Transform(
            safe_concave_hull(point_group.collected_geom, 0.75, true),
            3857
          ),
          15000
        ),
        4326
      )
      WHEN point_group.point_count >= 3 THEN ST_Transform(
        ST_Buffer(
          ST_Transform(
            safe_concave_hull(point_group.collected_geom, 0.90, true),
            3857
          ),
          20000
        ),
        4326
      )
      WHEN point_group.point_count = 2 THEN ST_Transform(
        ST_Buffer(
          ST_Transform(ST_ConvexHull(point_group.collected_geom), 3857),
          30000
        ),
        4326
      )
      WHEN point_group.point_count = 1 THEN ST_Buffer(
        ST_Centroid(point_group.collected_geom)::geography,
        50000
      )::geometry
      ELSE NULL
    END AS geom
  FROM searchable_markets AS market
  LEFT JOIN point_groups AS point_group
    ON point_group.market_id = market.market_id
),
-- Small buffers around each market's own facility points (5km) to ensure coverage
facility_point_buffers AS (
  SELECT
    fp.market_id,
    ST_Union(ST_Buffer(fp.geom::geography, 5000)::geometry) AS buffer_geom
  FROM facility_points fp
  GROUP BY fp.market_id
),
-- Markets that have county-union boundaries, augmented with facility point buffers for outliers
county_boundaries AS (
  SELECT
    market.market_id,
    ST_Multi(
      ST_CollectionExtract(
        ST_MakeValid(
          ST_WrapX(
            ST_Union(
              county_union.geom,
              COALESCE(fpb.buffer_geom, 'GEOMETRYCOLLECTION EMPTY'::geometry)
            ),
            -180, 360
          )
        ),
        3
      )
    ) AS geom,
    'county-union-v1' AS source_version
  FROM searchable_markets AS market
  INNER JOIN county_unions AS county_union
    ON county_union.market_id = market.market_id
  LEFT JOIN facility_point_buffers fpb ON fpb.market_id = market.market_id
),
-- Markets that need point-derived boundaries with Voronoi mutual exclusion
point_derived_markets AS (
  SELECT
    market.market_id,
    point_hull.geom AS hull_geom,
    ST_Centroid(point_hull.geom) AS centroid
  FROM searchable_markets AS market
  INNER JOIN point_hulls AS point_hull
    ON point_hull.market_id = market.market_id
  LEFT JOIN county_unions AS county_union
    ON county_union.market_id = market.market_id
  WHERE county_union.geom IS NULL
    AND point_hull.geom IS NOT NULL
    AND NOT ST_IsEmpty(point_hull.geom)
),
-- Generate Voronoi cells from all point-derived market centroids
voronoi_input AS (
  SELECT ST_Collect(centroid) AS all_centroids FROM point_derived_markets
),
voronoi_cells AS (
  SELECT (ST_Dump(ST_VoronoiPolygons(all_centroids, 0.0))).geom AS cell_geom
  FROM voronoi_input
  WHERE all_centroids IS NOT NULL
),
-- Match each Voronoi cell to its market by centroid containment
matched_voronoi AS (
  SELECT
    pdm.market_id,
    pdm.hull_geom,
    vc.cell_geom
  FROM point_derived_markets pdm
  JOIN voronoi_cells vc ON ST_Contains(vc.cell_geom, pdm.centroid)
),
-- Combine all county-union geometries into one shape to subtract from point-derived
all_county_geom AS (
  SELECT ST_UnaryUnion(ST_Collect(geom)) AS geom FROM county_boundaries
),
-- Clip hull to Voronoi cell and subtract county-union areas, then union facility buffers back
point_boundaries AS (
  SELECT
    mv.market_id,
    ST_Multi(
      ST_CollectionExtract(
        ST_MakeValid(
          ST_WrapX(
            ST_Union(
              CASE
                WHEN acg.geom IS NOT NULL AND ST_Intersects(ST_Intersection(mv.hull_geom, mv.cell_geom), acg.geom)
                THEN ST_Difference(ST_Intersection(mv.hull_geom, mv.cell_geom), acg.geom)
                ELSE ST_Intersection(mv.hull_geom, mv.cell_geom)
              END,
              COALESCE(fpb.buffer_geom, 'GEOMETRYCOLLECTION EMPTY'::geometry)
            ),
            -180, 360
          )
        ),
        3
      )
    ) AS geom,
    'point-derived-v2' AS source_version
  FROM matched_voronoi mv
  LEFT JOIN all_county_geom acg ON true
  LEFT JOIN facility_point_buffers fpb ON fpb.market_id = mv.market_id
),
final_boundaries AS (
  SELECT market_id, geom, source_version FROM county_boundaries
  UNION ALL
  SELECT market_id, geom, source_version FROM point_boundaries
  WHERE geom IS NOT NULL AND NOT ST_IsEmpty(geom)
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
  boundary.source_version
FROM final_boundaries AS boundary
WHERE boundary.geom IS NOT NULL
  AND NOT ST_IsEmpty(boundary.geom);

WITH latest_quarterly_absorption AS (
  SELECT
    ranked.market_id,
    ranked.absorption_override
  FROM (
    SELECT
      quarterly.market_id,
      quarterly.absorption_override,
      ROW_NUMBER() OVER (
        PARTITION BY quarterly.market_id
        ORDER BY quarterly.year DESC NULLS LAST,
          quarterly.quarter DESC NULLS LAST,
          quarterly.date_updated DESC NULLS LAST,
          quarterly.quarterly_data_id DESC
      ) AS absorption_rank
    FROM market_source.market_quarterly_data AS quarterly
    WHERE quarterly.market_id IS NOT NULL
      AND quarterly.absorption_override IS NOT NULL
  ) AS ranked
  WHERE ranked.absorption_rank = 1
),
latest_yearly_absorption AS (
  SELECT
    ranked.market_id,
    ranked.absorption
  FROM (
    SELECT
      yearly.market_id,
      yearly.absorption,
      ROW_NUMBER() OVER (
        PARTITION BY yearly.market_id
        ORDER BY yearly.year DESC NULLS LAST, yearly.date_updated DESC NULLS LAST, yearly.yearly_data_id DESC
      ) AS absorption_rank
    FROM market_source.market_yearly_data AS yearly
    WHERE yearly.market_id IS NOT NULL
      AND yearly.absorption IS NOT NULL
  ) AS ranked
  WHERE ranked.absorption_rank = 1
),
dominant_state AS (
  SELECT
    ranked.market_id,
    ranked.state_abbrev
  FROM (
    SELECT
      bridge.market_id,
      county.state_abbrev,
      COUNT(*) AS county_count,
      ROW_NUMBER() OVER (
        PARTITION BY bridge.market_id
        ORDER BY COUNT(*) DESC, county.state_abbrev ASC
      ) AS state_rank
    FROM analytics.bridge_county_market AS bridge
    INNER JOIN serve.boundary_county_geom_lod3 AS county
      ON county.county_fips = bridge.county_geoid
    WHERE bridge.market_id IS NOT NULL
      AND county.state_abbrev IS NOT NULL
    GROUP BY bridge.market_id, county.state_abbrev
  ) AS ranked
  WHERE ranked.state_rank = 1
)
INSERT INTO market_current.markets (
  market_id,
  name,
  region,
  country,
  state,
  absorption,
  vacancy,
  updated_at
)
SELECT
  market.market_id,
  COALESCE(NULLIF(BTRIM(market.name), ''), market.market_id) AS name,
  COALESCE(
    NULLIF(BTRIM(market.region), ''),
    CASE
      WHEN COALESCE(NULLIF(BTRIM(market.country), ''), CASE WHEN state_by_market.state_abbrev IS NOT NULL THEN 'US' ELSE NULL END) = 'US' THEN CASE
        WHEN COALESCE(NULLIF(BTRIM(market.state), ''), state_by_market.state_abbrev) IN (
          'CT', 'DC', 'DE', 'FL', 'GA', 'IN', 'KY', 'MA', 'MD', 'ME', 'MI', 'NC', 'NH', 'NJ',
          'NY', 'OH', 'PA', 'RI', 'SC', 'TN', 'VA', 'VT', 'WV'
        ) THEN 'Eastern US'
        WHEN COALESCE(NULLIF(BTRIM(market.state), ''), state_by_market.state_abbrev) IN (
          'AL', 'AR', 'IA', 'IL', 'KS', 'LA', 'MN', 'MO', 'MS', 'ND', 'NE', 'OK', 'SD', 'TX',
          'WI'
        ) THEN 'Central US'
        WHEN COALESCE(NULLIF(BTRIM(market.state), ''), state_by_market.state_abbrev) IN (
          'AK', 'AZ', 'CA', 'CO', 'HI', 'ID', 'MT', 'NM', 'NV', 'OR', 'UT', 'WA', 'WY'
        ) THEN 'Western US'
        ELSE 'US'
      END
      WHEN COALESCE(NULLIF(BTRIM(market.country), ''), '') IN ('CA', 'MX') THEN 'North America'
      WHEN COALESCE(NULLIF(BTRIM(market.country), ''), '') IN ('AR', 'BR', 'CL', 'CO', 'PE', 'UY', 'VE') THEN 'Latin America'
      WHEN COALESCE(NULLIF(BTRIM(market.country), ''), '') IN (
        'BE', 'CH', 'CZ', 'DE', 'DK', 'ES', 'FI', 'FR', 'GB', 'IE', 'IT', 'NL', 'NO', 'PL', 'SE'
      ) THEN 'Europe'
      WHEN COALESCE(NULLIF(BTRIM(market.country), ''), '') IN (
        'AU', 'CN', 'HK', 'ID', 'IN', 'JP', 'KR', 'MY', 'NZ', 'PH', 'SG', 'TH', 'TW'
      ) THEN 'Asia Pacific'
      WHEN COALESCE(NULLIF(BTRIM(market.country), ''), '') IN ('IL', 'SA') THEN 'Middle East'
      WHEN COALESCE(NULLIF(BTRIM(market.country), ''), '') IN ('NG', 'ZA') THEN 'Africa'
      ELSE 'International'
    END
  ) AS region,
  COALESCE(NULLIF(BTRIM(market.country), ''), CASE WHEN state_by_market.state_abbrev IS NOT NULL THEN 'US' ELSE NULL END) AS country,
  COALESCE(NULLIF(BTRIM(market.state), ''), state_by_market.state_abbrev) AS state,
  COALESCE(quarterly.absorption_override, yearly.absorption, market.absorption) AS absorption,
  market.vacancy,
  COALESCE(market.updated_at, now()) AS updated_at
FROM market_source.markets AS market
LEFT JOIN latest_quarterly_absorption AS quarterly
  ON quarterly.market_id = market.market_id
LEFT JOIN latest_yearly_absorption AS yearly
  ON yearly.market_id = market.market_id
LEFT JOIN dominant_state AS state_by_market
  ON state_by_market.market_id = market.market_id
WHERE market.market_id IS NOT NULL;

INSERT INTO market_current.submarket_points (submarket_id, name, market_id, center)
SELECT
  sp.id::text AS submarket_id,
  sp.name,
  m.market_id,
  sp.geom AS center
FROM spatial.submarket_points sp
JOIN market_current.markets m ON LOWER(BTRIM(sp.market)) = LOWER(BTRIM(m.name))
WHERE sp.geom IS NOT NULL
  AND sp.id IS NOT NULL
  AND sp.name IS NOT NULL
ON CONFLICT (submarket_id) DO NOTHING;

ANALYZE market_current.market_boundaries;
ANALYZE market_current.markets;
ANALYZE market_current.submarket_points;

COMMIT;

REFRESH MATERIALIZED VIEW market_current.submarket_boundaries;

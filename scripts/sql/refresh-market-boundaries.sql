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

TRUNCATE TABLE market_current.market_boundaries;
TRUNCATE TABLE market_current.markets;

WITH searchable_markets AS (
  SELECT
    market.market_id,
    market.name,
    market.center
  FROM market_source.markets AS market
  WHERE market.search_page
    AND market.market_id IS NOT NULL
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
point_sources AS (
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
  UNION ALL
  SELECT
    market.market_id,
    market.center AS geom
  FROM searchable_markets AS market
  WHERE market.center IS NOT NULL
),
point_groups AS (
  SELECT
    point_source.market_id,
    COUNT(*) AS point_count,
    ST_Collect(point_source.geom) AS collected_geom
  FROM point_sources AS point_source
  GROUP BY point_source.market_id
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
          ST_Transform(ST_ConcaveHull(point_group.collected_geom, 0.90, true), 3857),
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
final_boundaries AS (
  SELECT
    market.market_id,
    ST_Multi(
      ST_CollectionExtract(
        ST_MakeValid(COALESCE(county_union.geom, point_hull.geom)),
        3
      )
    ) AS geom,
    CASE
      WHEN county_union.geom IS NOT NULL THEN 'county-union-v1'
      WHEN point_hull.geom IS NOT NULL THEN 'point-derived-v1'
      ELSE NULL
    END AS source_version
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
WHERE market.search_page
  AND market.market_id IS NOT NULL;

ANALYZE market_current.market_boundaries;
ANALYZE market_current.markets;

COMMIT;

DO $$
BEGIN
  IF to_regclass('serve.facility_site') IS NULL THEN
    RAISE EXCEPTION 'missing source relation: serve.facility_site';
  END IF;

  IF to_regclass('serve.hyperscale_site') IS NULL THEN
    RAISE EXCEPTION 'missing source relation: serve.hyperscale_site';
  END IF;
END $$;

DROP TABLE IF EXISTS serve.facility_site_fast_next;

CREATE TABLE serve.facility_site_fast_next AS
WITH ranked_facilities AS (
  SELECT
    facility.facility_id,
    facility.facility_name,
    facility.provider_id,
    COALESCE(
      NULLIF(BTRIM(provider.provider_name), ''),
      NULLIF(INITCAP(REPLACE(facility.provider_slug, '-', ' ')), ''),
      facility.provider_id
    ) AS provider_name,
    COALESCE(facility.county_fips, ''::text) AS county_fips,
    NULLIF(BTRIM(facility.state_abbrev), '') AS state_abbrev,
    facility.commissioned_power_mw,
    facility.planned_power_mw,
    facility.under_construction_power_mw,
    facility.available_power_mw,
    NULL::numeric AS square_footage,
    facility.commissioned_semantic,
    NULL::text AS lease_or_own,
    NULL::text AS status_label,
    NULLIF(BTRIM(facility.provider_slug), '') AS facility_code,
    NULLIF(BTRIM(point_match.address), '') AS address,
    NULLIF(BTRIM(point_match.city), '') AS city,
    NULLIF(BTRIM(point_match.state), '') AS state,
    market.name AS market_name,
    ST_X(facility.geom) AS longitude,
    ST_Y(facility.geom) AS latitude,
    facility.geom,
    facility.geom_3857,
    facility.freshness_ts,
    ROW_NUMBER() OVER (
      PARTITION BY facility.facility_id
      ORDER BY facility.freshness_ts DESC NULLS LAST, facility.provider_id, facility.facility_name
    ) AS facility_rank
  FROM serve.facility_site AS facility
  LEFT JOIN facility_current.providers AS provider
    ON provider.provider_id = facility.provider_id
  LEFT JOIN LATERAL (
    SELECT
      point.address,
      point.city,
      point.state
    FROM spatial.colo_facility_points AS point
    WHERE 'colo:' || point.id::text = facility.facility_id
       OR ST_DWithin(point.geom, facility.geom, 0.001)
    ORDER BY
      CASE
        WHEN 'colo:' || point.id::text = facility.facility_id THEN 0
        ELSE 1
      END,
      point.geom <-> facility.geom
    LIMIT 1
  ) AS point_match ON true
  LEFT JOIN market_current.market_boundaries AS boundary
    ON ST_Contains(boundary.geom, facility.geom)
  LEFT JOIN market_current.markets AS market
    ON market.market_id = boundary.market_id
  WHERE facility.geom IS NOT NULL
    AND facility.geom_3857 IS NOT NULL
    AND facility.provider_id IS NOT NULL
)
SELECT
  facility_id,
  facility_name,
  provider_id,
  provider_name,
  county_fips,
  state_abbrev,
  commissioned_power_mw,
  planned_power_mw,
  under_construction_power_mw,
  available_power_mw,
  square_footage,
  commissioned_semantic,
  lease_or_own,
  status_label,
  facility_code,
  address,
  city,
  state,
  market_name,
  longitude,
  latitude,
  geom,
  geom_3857,
  freshness_ts
FROM ranked_facilities
WHERE facility_rank = 1;

CREATE UNIQUE INDEX facility_site_fast_next_facility_id_idx
  ON serve.facility_site_fast_next (facility_id);
CREATE INDEX facility_site_fast_next_geom_3857_gix
  ON serve.facility_site_fast_next
  USING GIST (geom_3857);
CREATE INDEX facility_site_fast_next_provider_id_idx
  ON serve.facility_site_fast_next (provider_id);

ANALYZE serve.facility_site_fast_next;

DROP TABLE IF EXISTS serve.hyperscale_site_fast_next;

CREATE TABLE serve.hyperscale_site_fast_next AS
WITH ranked_hyperscale AS (
  SELECT
    facility.hyperscale_id AS facility_id,
    facility.facility_name,
    facility.provider_id,
    COALESCE(
      NULLIF(BTRIM(facility.facility_name), ''),
      NULLIF(BTRIM(provider.provider_name), ''),
      facility.provider_id
    ) AS provider_name,
    COALESCE(facility.county_fips, ''::text) AS county_fips,
    NULLIF(BTRIM(facility.state_abbrev), '') AS state_abbrev,
    facility.commissioned_power_mw,
    facility.planned_power_mw,
    facility.under_construction_power_mw,
    NULL::numeric AS available_power_mw,
    NULL::numeric AS square_footage,
    facility.commissioned_semantic,
    facility.lease_or_own,
    NULL::text AS status_label,
    NULLIF(BTRIM(facility.facility_code), '') AS facility_code,
    NULLIF(BTRIM(point_match.address), '') AS address,
    NULLIF(BTRIM(point_match.city), '') AS city,
    NULLIF(BTRIM(point_match.state), '') AS state,
    market.name AS market_name,
    ST_X(facility.geom) AS longitude,
    ST_Y(facility.geom) AS latitude,
    facility.geom,
    facility.geom_3857,
    facility.freshness_ts,
    ROW_NUMBER() OVER (
      PARTITION BY facility.hyperscale_id
      ORDER BY facility.freshness_ts DESC NULLS LAST, facility.provider_id, facility.facility_name
    ) AS facility_rank
  FROM serve.hyperscale_site AS facility
  LEFT JOIN facility_current.providers AS provider
    ON provider.provider_id = facility.provider_id
  LEFT JOIN LATERAL (
    SELECT
      point.address,
      point.city,
      point.state
    FROM spatial.hyperscale_facility_points AS point
    WHERE ST_DWithin(facility.geom, point.geom, 0.001)
    ORDER BY point.geom <-> facility.geom
    LIMIT 1
  ) AS point_match ON true
  LEFT JOIN market_current.market_boundaries AS boundary
    ON ST_Contains(boundary.geom, facility.geom)
  LEFT JOIN market_current.markets AS market
    ON market.market_id = boundary.market_id
  WHERE facility.geom IS NOT NULL
    AND facility.geom_3857 IS NOT NULL
    AND facility.provider_id IS NOT NULL
)
SELECT
  facility_id,
  facility_name,
  provider_id,
  provider_name,
  county_fips,
  state_abbrev,
  commissioned_power_mw,
  planned_power_mw,
  under_construction_power_mw,
  available_power_mw,
  square_footage,
  commissioned_semantic,
  lease_or_own,
  status_label,
  facility_code,
  address,
  city,
  state,
  market_name,
  longitude,
  latitude,
  geom,
  geom_3857,
  freshness_ts
FROM ranked_hyperscale
WHERE facility_rank = 1;

CREATE UNIQUE INDEX hyperscale_site_fast_next_facility_id_idx
  ON serve.hyperscale_site_fast_next (facility_id);
CREATE INDEX hyperscale_site_fast_next_geom_3857_gix
  ON serve.hyperscale_site_fast_next
  USING GIST (geom_3857);
CREATE INDEX hyperscale_site_fast_next_provider_id_idx
  ON serve.hyperscale_site_fast_next (provider_id);

ANALYZE serve.hyperscale_site_fast_next;

DROP TABLE IF EXISTS serve.facility_site_fast;
ALTER TABLE serve.facility_site_fast_next RENAME TO facility_site_fast;

DROP TABLE IF EXISTS serve.hyperscale_site_fast;
ALTER TABLE serve.hyperscale_site_fast_next RENAME TO hyperscale_site_fast;

COMMENT ON TABLE serve.facility_site_fast IS
  'Daily-enriched colocation facility read model for interactive map/API requests.';
COMMENT ON TABLE serve.hyperscale_site_fast IS
  'Daily-enriched hyperscale facility read model for interactive map/API requests.';
